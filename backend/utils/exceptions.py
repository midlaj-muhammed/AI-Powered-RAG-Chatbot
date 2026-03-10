from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging
import traceback

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """Custom exception handler that adds structured logging."""
    response = exception_handler(exc, context)

    if response is not None:
        view_name = context.get("view", None).__class__.__name__ if context.get("view") else None
        logger.warning(
            "API error: %s %s %s",
            response.status_code,
            view_name,
            response.data,
        )
        response.data["status_code"] = response.status_code
    else:
        view_name = context.get("view", None).__class__.__name__ if context.get("view") else None
        logger.error(
            "Unhandled exception in %s: %s\n%s",
            view_name,
            str(exc),
            traceback.format_exc(),
        )
        response = Response(
            {"detail": str(exc), "status_code": 500},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response
