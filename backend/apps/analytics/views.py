"""Analytics views — admin dashboard data endpoints."""

import structlog
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Avg, Count, F, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chat.models import ChatSession, Message, MessageFeedback
from apps.documents.models import Document, DocumentChunk, DocumentStatus
from apps.users.permissions import IsAdmin, IsEditorOrAdmin

logger = structlog.get_logger(__name__)

DASHBOARD_CACHE_TTL = 60  # 1 minute
ANALYTICS_CACHE_TTL = 120  # 2 minutes


class DashboardOverviewView(APIView):
    """High-level analytics for the admin dashboard."""

    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def get(self, request):
        cache_key = "dashboard_overview"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        total_docs = Document.objects.filter(is_deleted=False).count()
        indexed_docs = Document.objects.filter(
            is_deleted=False, status=DocumentStatus.INDEXED
        ).count()
        total_sessions = ChatSession.objects.filter(is_archived=False).count()
        total_messages = Message.objects.count()
        avg_confidence = (
            Message.objects.filter(role="assistant", confidence_score__isnull=False)
            .aggregate(avg=Avg("confidence_score"))["avg"]
            or 0
        )
        total_chunks = DocumentChunk.objects.count()
        total_tokens = DocumentChunk.objects.aggregate(total=Sum("token_count"))["total"] or 0

        feedback_stats = MessageFeedback.objects.aggregate(
            total=Count("id"),
            helpful=Count("id", filter=Q(is_helpful=True)),
            not_helpful=Count("id", filter=Q(is_helpful=False)),
        )

        # Active users (last 7 days)
        week_ago = timezone.now() - timedelta(days=7)
        active_users = ChatSession.objects.filter(
            updated_at__gte=week_ago
        ).values("user").distinct().count()

        data = {
            "documents": {
                "total": total_docs,
                "indexed": indexed_docs,
                "pending": Document.objects.filter(
                    is_deleted=False, status=DocumentStatus.PENDING
                ).count(),
                "processing": Document.objects.filter(
                    is_deleted=False, status=DocumentStatus.PROCESSING
                ).count(),
                "error": Document.objects.filter(
                    is_deleted=False, status=DocumentStatus.ERROR
                ).count(),
                "total_chunks": total_chunks,
                "total_tokens": total_tokens,
            },
            "chat": {
                "total_sessions": total_sessions,
                "total_messages": total_messages,
                "active_users_7d": active_users,
            },
            "quality": {
                "avg_confidence": round(avg_confidence, 3),
                "total_feedback": feedback_stats["total"],
                "helpful": feedback_stats["helpful"],
                "not_helpful": feedback_stats["not_helpful"],
            },
        }
        cache.set(cache_key, data, DASHBOARD_CACHE_TTL)
        return Response(data)


class UsageTimelineView(APIView):
    """Daily usage stats for charts — messages and sessions over time."""

    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        days = min(days, 90)

        cache_key = f"usage_timeline_{days}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        start_date = timezone.now() - timedelta(days=days)

        # Messages per day
        messages_daily = (
            Message.objects.filter(created_at__gte=start_date)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(
                total=Count("id"),
                user_msgs=Count("id", filter=Q(role="user")),
                ai_msgs=Count("id", filter=Q(role="assistant")),
            )
            .order_by("date")
        )

        # Sessions per day
        sessions_daily = (
            ChatSession.objects.filter(created_at__gte=start_date)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(total=Count("id"))
            .order_by("date")
        )

        # Documents uploaded per day
        docs_daily = (
            Document.objects.filter(created_at__gte=start_date, is_deleted=False)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(total=Count("id"))
            .order_by("date")
        )

        data = {
            "messages": list(messages_daily),
            "sessions": list(sessions_daily),
            "documents": list(docs_daily),
        }
        cache.set(cache_key, data, ANALYTICS_CACHE_TTL)
        return Response(data)


class QueryAnalyticsView(APIView):
    """Query performance analytics — latency, tokens, confidence distribution."""

    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def get(self, request):
        cache_key = "query_analytics"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        ai_messages = Message.objects.filter(role="assistant")

        stats = ai_messages.aggregate(
            avg_latency=Avg("latency_ms"),
            avg_tokens=Avg("tokens_used"),
            avg_confidence=Avg("confidence_score"),
            total_tokens=Sum("tokens_used"),
        )

        # Confidence distribution bins
        confidence_dist = []
        bins = [(0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)]
        for low, high in bins:
            count = ai_messages.filter(
                confidence_score__gte=low, confidence_score__lt=high
            ).count()
            confidence_dist.append({
                "range": f"{int(low*100)}-{int(high*100)}%",
                "count": count,
            })

        # Recent slow queries (latency > 5s)
        slow_queries = (
            ai_messages.filter(latency_ms__gt=5000)
            .order_by("-created_at")
            .values("id", "latency_ms", "tokens_used", "confidence_score", "created_at")[:10]
        )

        data = {
            "averages": {
                "latency_ms": round(stats["avg_latency"] or 0, 1),
                "tokens_used": round(stats["avg_tokens"] or 0, 1),
                "confidence": round(stats["avg_confidence"] or 0, 3),
                "total_tokens": stats["total_tokens"] or 0,
            },
            "confidence_distribution": confidence_dist,
            "slow_queries": list(slow_queries),
        }
        cache.set(cache_key, data, ANALYTICS_CACHE_TTL)
        return Response(data)


class TopDocumentsView(APIView):
    """Most referenced documents in chat responses."""

    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def get(self, request):
        cache_key = "top_documents"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        # Count source references from message sources JSON
        ai_messages = Message.objects.filter(
            role="assistant",
        ).exclude(sources=[]).values_list("sources", flat=True)[:200]

        doc_counts: dict[str, int] = {}
        for sources in ai_messages:
            if isinstance(sources, list):
                for source in sources:
                    name = source.get("document_name", "Unknown")
                    doc_counts[name] = doc_counts.get(name, 0) + 1

        top_docs = sorted(doc_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        data = {
            "top_documents": [
                {"document_name": name, "reference_count": count}
                for name, count in top_docs
            ],
        }
        cache.set(cache_key, data, ANALYTICS_CACHE_TTL)
        return Response(data)
