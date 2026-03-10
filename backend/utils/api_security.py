"""
API Security utilities for request signing and validation.

This module provides HMAC-based request signing for sensitive operations
to ensure request integrity and authenticity.
"""

import hashlib
import hmac
import time

import structlog
from django.conf import settings

logger = structlog.get_logger(__name__)


# Shared secret for request signing (should be properly configured per client)
# In production, use environment variables or a secrets manager
DEFAULT_SIGNING_SECRET = getattr(settings, "API_SIGNING_SECRET", "")
SIGNING_ALGORITHM = getattr(settings, "API_SIGNING_ALGORITHM", "sha256")
TIMESTAMP_TOLERANCE_SECONDS = getattr(settings, "TIMESTAMP_TOLERANCE", 300)  # 5 minutes


class RequestSignatureError(Exception):
    """Raised when request signature validation fails."""

    pass


def generate_signature(
    method: str,
    url: str,
    body: str,
    timestamp: int,
    secret: str = DEFAULT_SIGNING_SECRET,
) -> str:
    """
    Generate HMAC signature for a request.

    Args:
        method: HTTP method (GET, POST, etc.)
        url: Full URL path including query string
        body: Request body (use empty string for GET/DELETE)
        timestamp: Unix timestamp in seconds
        secret: Shared secret for signing

    Returns:
        Hexadecimal HMAC signature

    Example:
        >>> sig = generate_signature("POST", "/api/chat/sessions/123/messages/", payload, timestamp)
    """
    # Create normalized payload string
    payload = f"{method}\n{url}\n{timestamp}\n{body}"

    # Generate HMAC
    if SIGNING_ALGORITHM == "sha256":
        signature = hmac.new(
            secret.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()
    elif SIGNING_ALGORITHM == "sha512":
        signature = hmac.new(
            secret.encode(), payload.encode(), hashlib.sha512
        ).hexdigest()
    else:
        raise ValueError(f"Unsupported signing algorithm: {SIGNING_ALGORITHM}")

    return signature


def validate_request_signature(
    request,
    secret: str = DEFAULT_SIGNING_SECRET,
    require_timestamp: bool = True,
) -> bool:
    """
    Validate the HMAC signature of a request.

    Args:
        request: Django request object
        secret: Shared secret for validation
        require_timestamp: Whether to require and validate timestamp

    Returns:
        True if signature is valid

    Raises:
        RequestSignatureError: If signature is invalid or missing
    """
    # Extract headers
    sig_header = request.META.get("HTTP_X_SIGNATURE")
    timestamp_header = request.META.get("HTTP_X_TIMESTAMP")

    if not sig_header:
        raise RequestSignatureError("Missing X-Signature header")

    if require_timestamp and not timestamp_header:
        raise RequestSignatureError("Missing X-Timestamp header")

    # Validate timestamp if present
    if require_timestamp and timestamp_header:
        try:
            timestamp = int(timestamp_header)
            current_time = int(time.time())

            if abs(current_time - timestamp) > TIMESTAMP_TOLERANCE_SECONDS:
                raise RequestSignatureError(
                    f"Timestamp too old or in future. Tolerance: {TIMESTAMP_TOLERANCE_SECONDS}s"
                )
        except ValueError as e:
            raise RequestSignatureError("Invalid timestamp format") from e

    # Get request body
    body = request.body.decode("utf-8") if request.body else ""

    # Build the URL
    url = request.path
    if request.META.get("QUERY_STRING"):
        url += f"?{request.META['QUERY_STRING']}"

    # Generate expected signature
    expected_sig = generate_signature(
        request.method,
        url,
        body,
        int(timestamp_header) if timestamp_header else 0,
        secret,
    )

    # Compare signatures securely
    if not hmac.compare_digest(expected_sig.lower(), sig_header.lower()):
        logger.warning(
            "signature_validation_failed",
            url=url,
            method=request.method,
            ip=_get_client_ip(request),
        )
        raise RequestSignatureError("Invalid request signature")

    return True


def require_signed_request(view_func):
    """
    Decorator that requires a valid HMAC signature for the view.

    Usage:
        @require_signed_request
        def my_sensitive_view(request):
            # View only processes signed requests
            return JsonResponse({"success": True})
    """

    def wrapper(request, *args, **kwargs):
        try:
            validate_request_signature(request)
        except RequestSignatureError as e:
            from django.http import JsonResponse

            return JsonResponse(
                {"detail": str(e), "code": "invalid_signature"},
                status=401,
            )
        return view_func(request, *args, **kwargs)

    return wrapper


def require_signed_request_or_admin(view_func):
    """
    Decorator that requires a valid HMAC signature OR admin user.
    This allows internal tools to use signatures while web UI uses session auth.

    Usage:
        @require_signed_request_or_admin
        def admin_endpoint(request):
            # Accepts either signed requests or authenticated admins
            return JsonResponse({"success": True})
    """

    def wrapper(request, *args, **kwargs):
        # Check if user is admin (staff)
        if (
            hasattr(request, "user")
            and request.user.is_authenticated
            and request.user.is_staff
        ):
            return view_func(request, *args, **kwargs)

        # Otherwise, require signature
        try:
            validate_request_signature(request)
        except RequestSignatureError as e:
            from django.http import JsonResponse

            return JsonResponse(
                {"detail": str(e), "code": "invalid_signature"},
                status=401,
            )
        return view_func(request, *args, **kwargs)

    return wrapper


# Client-side helper functions for generating signed requests
# These can be used by internal services or CLI tools


class SignedRequestClient:
    """
    Helper class for making signed requests to the API.
    Intended for use in CLI tools, background jobs, and microservices.
    """

    def __init__(self, secret: str = DEFAULT_SIGNING_SECRET):
        self.secret = secret

    def sign_request(
        self,
        method: str,
        path: str,
        body: str = "",
        query_params: dict[str, str] | None = None,
    ) -> dict[str, str]:
        """
        Generate headers for a signed request.

        Returns:
            Dict with 'X-Signature' and 'X-Timestamp' headers

        Example:
            >>> client = SignedRequestClient()
            >>> headers = client.sign_request("POST", "/api/chat/", payload)
            >>> requests.post(url, json=data, headers=headers)
        """
        # Build full URL path
        url = path
        if query_params:
            from urllib.parse import urlencode

            url += f"?{urlencode(query_params)}"

        timestamp = int(time.time())
        signature = generate_signature(method, url, body, timestamp, self.secret)

        return {
            "X-Signature": signature,
            "X-Timestamp": str(timestamp),
        }


def _get_client_ip(request) -> str:
    """Extract client IP from request headers."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    x_real_ip = request.META.get("HTTP_X_REAL_IP")
    if x_real_ip:
        return x_real_ip
    return request.META.get("REMOTE_ADDR", "unknown")


# DRF permission class for signed requests
class IsSignedRequest:
    """
    DRF permission class that requires request signature.

    Usage in views:
        class MyAPIView(APIView):
            permission_classes = [IsSignedRequest]

            def post(self, request):
                # Request is guaranteed to be signed
                pass
    """

    def has_permission(self, request, view):
        try:
            return validate_request_signature(request)
        except RequestSignatureError:
            return False


def get_client_signature_headers(request):
    """
    Helper to get and validate signature headers from a request.
    Returns None if headers are missing or invalid.

    Useful for logging and debugging security issues.
    """
    sig = request.META.get("HTTP_X_SIGNATURE")
    timestamp = request.META.get("HTTP_X_TIMESTAMP")

    if not sig or not timestamp:
        return None

    return {
        "signature": sig[:16] + "...",  # Log only partial signature
        "timestamp": timestamp,
        "ip": _get_client_ip(request),
    }


# Rate limiting based on signature to allow trusted clients higher limits
def get_signature_rate_limit_key(request) -> str | None:
    """
    Generate a rate limit key based on request signature.
    Allows signed requests to have different rate limits.

    Returns:
        Rate limit key string or None if not signed
    """
    try:
        validate_request_signature(request)
        # Use signature as key - same secret = same rate limit
        sig = request.META.get("HTTP_X_SIGNATURE", "")
        return f"signed:{sig[:20]}"  # First 20 chars of signature
    except RequestSignatureError:
        return None
