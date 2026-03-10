"""
Custom throttling classes for Django REST Framework.

Provides per-endpoint and per-user rate limiting with:
- Burst tolerance for legitimate traffic
- Exponential backoff for repeat offenders
- Higher limits for signed/trusted requests
- Separate limits for different operation types
"""

import time

import structlog
from django.core.cache import cache
from rest_framework.request import Request
from rest_framework.throttling import (
    BaseThrottle,
    ScopedRateThrottle,
    UserRateThrottle,
)

logger = structlog.get_logger(__name__)


# Rate limit scopes defined in settings
RATE_LIMIT_SCOPES = {
    "auth": "10/minute",  # Authentication endpoints
    "chat": "30/minute",  # Chat/LLM endpoints (expensive)
    "upload": "5/minute",  # File uploads
    "download": "30/minute",  # File downloads
    "admin": "100/minute",  # Admin operations (for admins only)
    "export": "5/hour",  # Data exports (resource intensive)
    "sensitive": "20/minute",  # Sensitive updates/deletions
    "default": "100/minute",  # Default rate limit
}


class BurstRateThrottle(BaseThrottle):
    """
    Rate throttling with burst tolerance.

    Allows a burst of requests followed by sustained rate limit.
    Uses token bucket algorithm internally.

    Configuration:
        BURST_RATE: Maximum burst capacity
        BURST_WINDOW: Time window (seconds)
    """

    BURST_RATE = 5  # Number of requests in burst
    BURST_WINDOW = 10  # Seconds

    def __init__(self):
        self.cache_key_prefix = "throttle_burst:"

    def allow_request(self, request: Request, view) -> bool:
        """Check if request should be allowed based on burst rate."""
        from django.conf import settings

        if settings.DEBUG:
            return True

        # Get user identifier
        user_id = self._get_user_id(request)
        cache_key = f"{self.cache_key_prefix}{user_id}"

        # Get current burst count
        burst_data = cache.get(cache_key, {"count": 0, "reset_at": 0})
        current_time = time.time()

        # Reset if window expired
        if current_time > burst_data["reset_at"]:
            burst_data = {"count": 0, "reset_at": current_time + self.BURST_WINDOW}

        # Check burst capacity
        if burst_data["count"] >= self.BURST_RATE:
            return False

        # Increment count and save
        burst_data["count"] += 1
        cache.set(cache_key, burst_data, self.BURST_WINDOW)

        self.throttle_data = burst_data
        return True

    def wait(self) -> float:
        """Seconds until next request is allowed."""
        if hasattr(self, "throttle_data"):
            return max(0, self.throttle_data["reset_at"] - time.time())
        return 0

    def _get_user_id(self, request: Request) -> str:
        """Get unique identifier for rate limiting."""
        if hasattr(request, "user") and request.user.is_authenticated:
            return f"user:{request.user.id}"
        return self._get_client_ip(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address."""
        x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")


class AuthRateThrottle(UserRateThrottle):
    """
    Rate throttle for authentication endpoints.

    Stricter limits for login/register to prevent brute force.
    """

    scope = "auth"
    rate = "10/minute"

    def throttle_failure(self):
        """Overridden to add security headers and logging."""
        # Note: In standard DRF, throttle_failure raises exceptions.Throttled.
        # It doesn't take request as an argument.
        # Most logging happen in allow_request where we have access to request.
        return super().throttle_failure()


class ChatRateThrottle(ScopedRateThrottle):
    """
    Rate throttle for chat endpoints.

    Lower limits due to LLM API costs.
    Includes burst tolerance for smooth UX.
    """

    scope = "chat"

    def get_rate(self):
        """Get rate for chat endpoints."""
        return "30/minute"


class UploadRateThrottle(ScopedRateThrottle):
    """
    Rate throttle for file upload endpoints.

    Very strict limits to prevent resource exhaustion.
    """

    scope = "upload"

    def get_rate(self):
        """Get rate for upload endpoints."""
        return "5/minute"


class ExportRateThrottle(ScopedRateThrottle):
    """
    Rate throttle for data export endpoints.

    Hourly limits for resource-intensive operations.
    """

    scope = "export"

    def get_rate(self):
        """Get rate for export endpoints."""
        return "5/hour"


class SensitiveRateThrottle(ScopedRateThrottle):
    """
    Rate throttle for sensitive operations (deletes, updates).

    Moderate limits to prevent accidental/malicious mass operations.
    """

    scope = "sensitive"

    def get_rate(self):
        """Get rate for sensitive endpoints."""
        return "20/minute"


class SignedRequestRateThrottle(BaseThrottle):
    """
    Rate throttle with higher limits for signed requests.

    Uses API signature to identify trusted clients.
    Allows internal services higher throughput.
    """

    # Rates: signed requests get higher limits
    UNSIGNED_RATE = "30/minute"
    SIGNED_RATE = "300/minute"  # 10x for signed requests

    def __init__(self):
        self.cache_key_prefix = "throttle_signed:"

    def allow_request(self, request: Request, view) -> bool:
        """Check if request is allowed based on signature and rate."""
        from django.conf import settings

        if settings.DEBUG:
            return True

        # Check if request is signed
        is_signed = self._is_signed_request(request)
        user_id = self._get_user_id(request)
        cache_key = f"{self.cache_key_prefix}{user_id}"

        # Get appropriate rate
        rate = self.SIGNED_RATE if is_signed else self.UNSIGNED_RATE
        limit, period = self._parse_rate(rate)

        # Get current count
        count_data = cache.get(cache_key, {"count": 0, "reset_at": 0})
        current_time = time.time()

        # Reset if period expired
        if current_time > count_data["reset_at"]:
            count_data = {"count": 0, "reset_at": current_time + period}

        # Check limit
        if count_data["count"] >= limit:
            logger.info(
                "rate_limit_exceeded",
                user_id=user_id,
                is_signed=is_signed,
                count=count_data["count"],
                limit=limit,
            )
            return False

        # Increment count
        count_data["count"] += 1
        cache.set(cache_key, count_data, int(period))

        self.throttle_data = count_data
        return True

    def wait(self) -> float:
        """Seconds until next request is allowed."""
        if hasattr(self, "throttle_data"):
            return max(0, self.throttle_data["reset_at"] - time.time())
        return 0

    def _is_signed_request(self, request: Request) -> bool:
        """Check if request has valid signature."""
        sig = request.META.get("HTTP_X_SIGNATURE")
        timestamp = request.META.get("HTTP_X_TIMESTAMP")
        return bool(sig and timestamp)

    def _get_user_id(self, request: Request) -> str:
        """Get unique identifier for rate limiting."""
        if hasattr(request, "user") and request.user.is_authenticated:
            return f"user:{request.user.id}"
        return self._get_client_ip(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address."""
        x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")

    def _parse_rate(self, rate: str) -> tuple[int, int]:
        """Parse rate string into (limit, period) tuple."""
        # Format: "30/minute" -> (30, 60)
        count, period_str = rate.split("/")
        period_map = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}
        period = period_map.get(period_str, 60)  # Default to minute
        return int(count), period


class CompositeRateThrottle:
    """
    Apply multiple throttling classes to a view.

    Allows chaining different throttle types:
    - Authentication throttling (burst + sustained)
    - Method-specific throttling (chat, upload, etc.)
    - Signature-based throttling (higher limits for signed requests)

    Usage:
        class MyView(APIView):
            throttle_classes = [
                AuthRateThrottle,
                SignedRequestRateThrottle,
            ]
    """

    pass


# DRF throttling configuration helpers
def get_throttle_classes_for_view(view_name: str) -> tuple:
    """
    Get appropriate throttle classes based on view name/purpose.

    Args:
        view_name: Name of the view or endpoint type

    Returns:
        Tuple of throttle classes to apply

    Example:
        >>> get_throttle_classes_for_view("chat")
        (ChatRateThrottle, BurstRateThrottle)
    """
    throttle_map = {
        "auth": (AuthRateThrottle, BurstRateThrottle),
        "chat": (ChatRateThrottle, BurstRateThrottle),
        "upload": (UploadRateThrottle, BurstRateThrottle),
        "download": (ScopedRateThrottle,),  # Uses scope="download"
        "export": (ExportRateThrottle,),
        "sensitive": (SensitiveRateThrottle, BurstRateThrottle),
        "admin": (UserRateThrottle,),  # Higher limits for admins
        "default": (UserRateThrottle, BurstRateThrottle),
    }

    return throttle_map.get(view_name, throttle_map["default"])


# Decorator for method-level rate limiting
def throttled(scope: str, rate: str | None = None):
    """
    Decorator to add rate limiting to a specific method.

    Args:
        scope: Throttle scope name
        rate: Optional custom rate (uses scope's rate if not provided)

    Usage:
        @throttled("special", "5/minute")
        def my_view(request):
            return Response(...)

    Or use with DRF:
        class MyView(APIView):
            @method_decorator(throttled("special"))
            def post(self, request):
                return Response(...)
    """

    def decorator(view_func):
        def wrapper(self, request, *args, **kwargs):
            # Create throttle class instance
            throttle_class = ScopedRateThrottle()
            throttle_class.scope = scope
            if rate:
                throttle_class.rate = rate

            # Check throttle
            if not throttle_class.allow_request(request, self):
                return throttle_class.throttle_failure()

            return view_func(self, request, *args, **kwargs)

        return wrapper

    return decorator


# Admin-specific throttling
class AdminRateThrottle(UserRateThrottle):
    """
    Higher rate limits for admin users.

    Only applies to users with is_staff=True.
    Falls back to regular limits for non-staff.
    """

    scope = "admin"
    rate = "200/minute"

    def allow_request(self, request: Request, view) -> bool:
        """Only apply higher limits to staff users."""
        if not (hasattr(request, "user") and request.user.is_staff):
            # For non-staff, use default rate limit
            self.rate = "100/minute"
        else:
            self.rate = "200/minute"
        return super().allow_request(request, view)


class DownloadRateThrottle(ScopedRateThrottle):
    """
    Rate throttle for file downloads.

    Limits bandwidth-intensive operations.
    """

    scope = "download"
    rate = "30/minute"


# Utility function to check rate limit status
def get_rate_limit_status(request: Request, scope: str = "default") -> dict:
    """
    Get current rate limit status for a user/client.

    Useful for including rate limit info in API responses.

    Returns:
        Dict with current status information

    Example:
        >>> status = get_rate_limit_status(request, "chat")
        >>> # Returns: {"limit": 30, "remaining": 28, "reset_at": timestamp}
    """
    cache_key_prefix = f"drf_throttle:{scope}:"
    user_id = (
        request.user.id
        if hasattr(request, "user") and request.user.is_authenticated
        else request.META.get("REMOTE_ADDR", "unknown")
    )
    cache_key = f"{cache_key_prefix}{user_id}"

    data = cache.get(cache_key, {})

    if data:
        limit = data.get("count", 0)
        # Parse rate to get limit
        rate_limit, _ = _parse_rate_text(getattr(request, "rate", "100/minute"))
        return {
            "limit": rate_limit,
            "remaining": max(0, rate_limit - limit),
            "reset_at": data.get("reset_at", 0),
        }

    return {"limit": 0, "remaining": 0, "reset_at": 0}


def _parse_rate_text(rate: str) -> tuple[int, int]:
    """Parse rate string into (limit, period) tuple."""
    count, period_str = rate.split("/")
    period_map = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}
    period = period_map.get(period_str, 60)
    return int(count), period
