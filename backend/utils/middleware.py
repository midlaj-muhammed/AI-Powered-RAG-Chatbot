"""Custom security middleware for the RAG Chatbot."""

import time
from collections import defaultdict
from typing import Optional

from django.conf import settings
from django.core.cache import cache
from django.utils.deprecation import MiddlewareMixin
import structlog

logger = structlog.get_logger(__name__)


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Add security headers to all responses."""

    # Rate limiting for suspicious activity (in-memory fallback)
    sus_activity_counts = defaultdict(int)
    sus_activity_reset = 0

    def process_response(self, request, response):
        # Permissions-Policy
        response["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), "
            "interest-cohort=(), browsing-topics=()"
        )

        # Content Security Policy
        if hasattr(settings, "CSP_DEFAULT_SRC"):
            csp_parts = []
            for directive, values in [
                ("default-src", getattr(settings, "CSP_DEFAULT_SRC", ())),
                ("script-src", getattr(settings, "CSP_SCRIPT_SRC", ())),
                ("style-src", getattr(settings, "CSP_STYLE_SRC", ())),
                ("img-src", getattr(settings, "CSP_IMG_SRC", ())),
                ("font-src", getattr(settings, "CSP_FONT_SRC", ())),
                ("connect-src", getattr(settings, "CSP_CONNECT_SRC", ())),
                ("frame-ancestors", ("'none'",)),
                ("form-action", ("'self'",)),
            ]:
                if values:
                    csp_parts.append(f"{directive} {' '.join(values)}")
            if csp_parts:
                response["Content-Security-Policy"] = "; ".join(csp_parts)

        # Cache-Control for API responses
        if request.path.startswith("/api/") and "Cache-Control" not in response:
            response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

        # X-Content-Type-Options
        response["X-Content-Type-Options"] = "nosniff"

        # Remove server signature if not in debug
        if not settings.DEBUG and "Server" in response:
            del response["Server"]

        return response


class RateLimitMiddleware(MiddlewareMixin):
    """Enhanced rate limiting with IP tracking and suspicious activity detection."""

    RATE_LIMITS = {
        "default": 100,           # requests per minute
        "auth": 5,                # login attempts per minute
        "upload": 10,             # uploads per minute
        "sensitive": 20,          # sensitive operations per minute
    }

    SUSPICIOUS_THRESHOLD = 10  # Failed attempts to flag as suspicious

    def process_request(self, request):
        """Check rate limits before processing request."""
        if settings.DEBUG:
            return None

        # Get client IP (handle proxy headers)
        ip = self._get_client_ip(request)
        user_id = getattr(request.user, "id", None) if hasattr(request, "user") else None

        # Determine rate limit category
        category = self._get_request_category(request)
        limit = self.RATE_LIMITS.get(category, self.RATE_LIMITS["default"])

        # Use Redis cache for distributed rate limiting
        cache_key = f"ratelimit:{category}:{ip}:{user_id or 'anon'}"
        count = cache.get(cache_key, 0)

        if count >= limit:
            logger.warning(
                "rate_limit_exceeded",
                ip=ip,
                category=category,
                count=count,
                limit=limit,
                path=request.path,
            )
            # Return JSON response with rate limit headers
            from django.http import JsonResponse
            response = JsonResponse(
                {"detail": f"Rate limit exceeded. Maximum {limit} requests per minute."},
                status=429,
            )
            response["Retry-After"] = "60"
            response["X-RateLimit-Limit"] = str(limit)
            response["X-RateLimit-Remaining"] = "0"
            return response

        # Increment counter
        cache.set(cache_key, count + 1, timeout=60)

        return None

    def _get_client_ip(self, request) -> str:
        """Extract client IP from request headers, accounting for proxies."""
        if hasattr(request, "META"):
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            if x_forwarded_for:
                # Take the first IP in the chain
                return x_forwarded_for.split(",")[0].strip()
            x_real_ip = request.META.get("HTTP_X_REAL_IP")
            if x_real_ip:
                return x_real_ip
            return request.META.get("REMOTE_ADDR", "unknown")
        return "unknown"

    def _get_request_category(self, request) -> str:
        """Categorize request for rate limiting."""
        path = request.path.lower()

        if "/auth/" in path or "/login/" in path or "/register/" in path:
            return "auth"
        elif "/upload/" in path and request.method == "POST":
            return "upload"
        elif "/documents/" in path and request.method in ["POST", "DELETE", "PATCH"]:
            return "sensitive"
        elif "/users/" in path and request.method in ["POST", "DELETE", "PATCH"]:
            return "sensitive"

        return "default"


class RequestSizeMiddleware(MiddlewareMixin):
    """Middleware to enforce request size limits beyond Django defaults."""

    MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10MB default

    def process_request(self, request):
        """Check request size before processing."""
        if hasattr(request, "META"):
            content_length = request.META.get("CONTENT_LENGTH")
            if content_length:
                try:
                    size = int(content_length)
                    max_size = self._get_max_size_for_path(request.path)
                    if size > max_size:
                        logger.warning(
                            "request_too_large",
                            size=size,
                            max_size=max_size,
                            path=request.path,
                        )
                        from django.http import JsonResponse
                        return JsonResponse(
                            {"detail": f"Request body too large. Maximum {max_size // (1024*1024)}MB."},
                            status=413,
                        )
                except (ValueError, TypeError):
                    pass
        return None

    def _get_max_size_for_path(self, path: str) -> int:
        """Get appropriate size limit based on endpoint."""
        if "/upload/" in path:
            # Allow larger uploads for file upload endpoints
            return getattr(settings, "MAX_UPLOAD_SIZE", 50 * 1024 * 1024)
        return self.MAX_REQUEST_SIZE


class RequestIDMiddleware(MiddlewareMixin):
    """Add unique request ID to all requests for tracing."""

    def process_request(self, request):
        """Generate and attach request ID."""
        import uuid
        request.id = getattr(request, 'id', str(uuid.uuid4()))
        return None

    def process_response(self, request, response):
        """Add request ID to response headers."""
        if hasattr(request, 'id'):
            response['X-Request-ID'] = request.id
        return response


class IPBlacklistMiddleware(MiddlewareMixin):
    """Block requests from blacklisted IPs with cache-based blacklist."""

    def process_request(self, request):
        """Check if request IP is blacklisted."""
        if settings.DEBUG:
            return None

        ip = self._get_client_ip(request)
        blacklist_key = f"ip_blacklist:{ip}"

        if cache.get(blacklist_key):
            logger.warning(
                "blocked_blacklisted_ip",
                ip=ip,
                path=request.path,
            )
            from django.http import JsonResponse
            response = JsonResponse(
                {"detail": "Access denied. Your IP has been blocked due to suspicious activity."},
                status=403,
            )
            response["X-Blocked-Reason"] = "IP_BLACKLIST"
            return response

        return None

    def _get_client_ip(self, request) -> str:
        """Extract client IP from request headers."""
        if hasattr(request, "META"):
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            if x_forwarded_for:
                return x_forwarded_for.split(",")[0].strip()
            x_real_ip = request.META.get("HTTP_X_REAL_IP")
            if x_real_ip:
                return x_real_ip
            return request.META.get("REMOTE_ADDR", "unknown")
        return "unknown"

    @classmethod
    def block_ip(cls, ip: str, duration_hours: int = 24) -> None:
        """Add IP to blacklist for specified duration."""
        cache_key = f"ip_blacklist:{ip}"
        cache.set(cache_key, True, timeout=duration_hours * 3600)
        logger.info("ip_blocked", ip=ip, duration_hours=duration_hours)

    @classmethod
    def unblock_ip(cls, ip: str) -> None:
        """Remove IP from blacklist."""
        cache_key = f"ip_blacklist:{ip}"
        cache.delete(cache_key)
        logger.info("ip_unblocked", ip=ip)


class AttackDetectionMiddleware(MiddlewareMixin):
    """Detect and mitigate common attack patterns."""

    PATTERNS = {
        "sql_injection": [
            r"(?i)(union.*select|insert.*into|delete.*from|drop.*table|update.*set)",
            r"(?i)(--|;|\/\*|\*\/)",
            r"(?i)(script|xss|javascript:|onerror=|onload=)",
        ],
        "path_traversal": [
            r"\.\.[/\\]",
            r"%2e%2e%2f",
            r"%2e%2e%5c",
        ],
        "command_injection": [
            r"(?i)(\||;|&|\$\(|`)",
        ],
    }

    def process_request(self, request):
        """Check request for attack patterns."""
        if settings.DEBUG or not request.method in ["POST", "PUT", "PATCH"]:
            return None

        flagged = False
        reasons = []

        # Check query parameters
        for key, value in request.GET.items():
            if self._check_for_patterns(str(value)):
                flagged = True
                reasons.append(f"query_param_{key}")

        # Check POST data
        for key, value in request.POST.items():
            if self._check_for_patterns(str(value)):
                flagged = True
                reasons.append(f"post_data_{key}")

        # Check path
        if self._check_for_patterns(request.path):
            flagged = True
            reasons.append("path")

        if flagged:
            ip = self._get_client_ip(request)
            logger.warning(
                "attack_pattern_detected",
                ip=ip,
                reasons=reasons,
                path=request.path,
                method=request.method,
            )
            # Block suspicious IPs temporarily
            IPBlacklistMiddleware.block_ip(ip, duration_hours=1)
            from django.http import JsonResponse
            return JsonResponse(
                {"detail": "Request blocked due to potential attack pattern."},
                status=403,
            )

        return None

    def _check_for_patterns(self, value: str) -> bool:
        """Check if value matches any attack patterns."""
        import re
        for pattern_name, patterns in self.PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, value):
                    return True
        return False

    def _get_client_ip(self, request) -> str:
        """Extract client IP from request headers."""
        if hasattr(request, "META"):
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            if x_forwarded_for:
                return x_forwarded_for.split(",")[0].strip()
            return request.META.get("REMOTE_ADDR", "unknown")
        return "unknown"
