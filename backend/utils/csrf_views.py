"""Custom CSRF failure views."""

from django.http import JsonResponse
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_POST


def csrf_failure_view(request, reason=""):
    """
    Custom CSRF failure handler.
    Returns JSON for API requests, HTML for browser requests.
    """
    import structlog
    logger = structlog.get_logger(__name__)

    # Log the CSRF failure for security monitoring
    logger.warning(
        "csrf_failure",
        reason=reason or "Unknown",
        path=request.path,
        method=request.method,
        ip=_get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )

    # Check if this is an API request
    is_api = request.path.startswith("/api/")

    if is_api:
        return JsonResponse(
            {
                "detail": "CSRF token missing or invalid.",
                "code": "csrf_failed",
            },
            status=403,
        )

    # For browser requests, return a simple error page
    return JsonResponse(
        {
            "detail": "Security verification failed. Please refresh the page and try again.",
        },
        status=403,
    )


def _get_client_ip(request):
    """Extract client IP from request headers."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    x_real_ip = request.META.get("HTTP_X_REAL_IP")
    if x_real_ip:
        return x_real_ip
    return request.META.get("REMOTE_ADDR", "unknown")


@sensitive_post_parameters()
@require_POST
def verify_csrf(request):
    """
    Endpoint for SPA to verify CSRF token validity.
    Returns 204 if valid, 403 otherwise.
    """
    from django.middleware.csrf import get_token
    from django.views.decorators.csrf import ensure_csrf_cookie

    # Ensure CSRF cookie is set
    get_token(request)

    return JsonResponse(
        {"csrf_token": get_token(request)},
        status=200,
    )
