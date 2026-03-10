import structlog
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = structlog.get_logger(__name__)


class HealthCheckView(APIView):
    """System health check endpoint."""

    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        health = {
            "status": "healthy",
            "services": {},
        }

        # Check PostgreSQL
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            health["services"]["database"] = {"status": "up"}
        except Exception as e:
            health["services"]["database"] = {"status": "down", "error": str(e)}
            health["status"] = "unhealthy"

        # Check Redis
        try:
            cache.set("health_check", "ok", 10)
            result = cache.get("health_check")
            if result == "ok":
                health["services"]["redis"] = {"status": "up"}
            else:
                health["services"]["redis"] = {"status": "down", "error": "Cache read failed"}
                health["status"] = "unhealthy"
        except Exception as e:
            health["services"]["redis"] = {"status": "down", "error": str(e)}
            health["status"] = "unhealthy"

        # Check Chroma
        try:
            from apps.rag.vectorstore import get_vectorstore
            vs = get_vectorstore()
            count = vs._collection.count()
            health["services"]["chroma"] = {"status": "up", "documents": count}
        except Exception as e:
            health["services"]["chroma"] = {"status": "down", "error": str(e)}
            health["status"] = "degraded"

        # Check Google API Key configured
        if settings.GOOGLE_API_KEY:
            health["services"]["google_ai"] = {"status": "configured"}
        else:
            health["services"]["google_ai"] = {"status": "not_configured"}
            health["status"] = "degraded"

        status_code = (
            status.HTTP_200_OK
            if health["status"] == "healthy"
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(health, status=status_code)
