import csv
import io
import json
from typing import cast

import structlog
from django.db.models import Count, Q, Subquery, OuterRef, Prefetch
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chat.models import (
    ChatSession,
    Message,
    MessageFeedback,
    MessageRole,
    SavedSearch,
)
from apps.chat.serializers import (
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
    MessageFeedbackSerializer,
    QueryHistorySerializer,
    SavedSearchSerializer,
    SendMessageSerializer,
)
from apps.rag.services.rag_chain import stream_chat_response
from apps.rag.services.gemini_client import get_llm
from apps.rag.prompts import SUGGESTION_GENERATION_PROMPT
from apps.documents.models import Document
from apps.users.models import User, UserRole

logger = structlog.get_logger(__name__)


class ChatSessionListCreateView(generics.ListCreateAPIView):
    """List user's chat sessions or create a new one."""

    serializer_class = ChatSessionListSerializer

    def get_queryset(self):
        user = cast(User, self.request.user)
        if user.role == UserRole.ADMIN:
            queryset = ChatSession.objects.filter(is_archived=False)
        else:
            queryset = ChatSession.objects.filter(user=user, is_archived=False)
            
        last_message = Message.objects.filter(session=OuterRef("pk")).order_by("-created_at")
        
        return (
            queryset.annotate(
                message_count=Count("messages"),
                last_msg_role=Subquery(last_message.values("role")[:1]),
                last_msg_content=Subquery(last_message.values("content")[:1]),
                last_msg_created_at=Subquery(last_message.values("created_at")[:1]),
            )
            .order_by("-updated_at")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ChatSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a specific chat session."""

    serializer_class = ChatSessionDetailSerializer

    def get_queryset(self):
        user = cast(User, self.request.user)
        if user.role == UserRole.ADMIN:
            return ChatSession.objects.all()
        return ChatSession.objects.filter(user=user)

    def perform_destroy(self, instance):
        # Soft delete — archive instead of deleting
        instance.is_archived = True
        instance.save(update_fields=["is_archived"])


class SendMessageView(APIView):
    """Send a message and stream the AI response via SSE."""

    def post(self, request, session_id):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
        except ChatSession.DoesNotExist:
            return Response(
                {"detail": "Chat session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        content = serializer.validated_data["content"]
        collection = serializer.validated_data.get("collection", "default")
        attachment_ids = serializer.validated_data.get("attachment_ids", [])

        response = StreamingHttpResponse(
            stream_chat_response(session, content, collection, attachment_ids),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class MessageFeedbackView(APIView):
    """Submit feedback (thumbs up/down) for a message."""

    def post(self, request, message_id):
        try:
            message = Message.objects.get(
                id=message_id,
                role=MessageRole.ASSISTANT,
                session__user=request.user,
            )
        except Message.DoesNotExist:
            return Response(
                {"detail": "Message not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MessageFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        feedback, created = MessageFeedback.objects.update_or_create(
            message=message,
            user=request.user,
            defaults=serializer.validated_data,
        )

        return Response(
            MessageFeedbackSerializer(feedback).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AttachmentUploadView(APIView):
    """Upload a file for use as a chat attachment."""

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"detail": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.conf import settings

        # Validate size
        if file_obj.size > settings.MAX_UPLOAD_SIZE:
            return Response(
                {
                    "detail": f"File too large. Max size is {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate MIME type
        if file_obj.content_type not in settings.ALLOWED_UPLOAD_TYPES:
            return Response(
                {
                    "detail": f"File type {file_obj.content_type} not supported for chat attachments."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.chat.models import MessageAttachment

        attachment = MessageAttachment.objects.create(
            message=None,  # Will be linked when the message is sent
            file=file_obj,
            mime_type=file_obj.content_type,
            file_size=file_obj.size,
            filename=file_obj.name,
        )

        return Response(
            {
                "id": str(attachment.id),
                "filename": attachment.filename,
                "mime_type": attachment.mime_type,
            },
            status=status.HTTP_201_CREATED,
        )


class ToggleFavoriteView(APIView):
    """Toggle favorite status on a message."""

    def post(self, request, message_id):
        try:
            message = Message.objects.get(
                id=message_id,
                session__user=request.user,
            )
        except Message.DoesNotExist:
            return Response(
                {"detail": "Message not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        message.is_favorite = not message.is_favorite
        message.save(update_fields=["is_favorite"])

        return Response({"is_favorite": message.is_favorite})


# ---------------------------------------------------------------------------
# Phase 3: Query History
# ---------------------------------------------------------------------------


class QueryHistoryView(generics.ListAPIView):
    """List user's past queries with search, filter, and ordering."""

    serializer_class = QueryHistorySerializer

    def get_queryset(self):
        user = cast(User, self.request.user)
        # Prefetch assistant messages to avoid N+1 in ai_response
        ai_responses_prefetch = Prefetch(
            "session__messages",
            queryset=Message.objects.filter(role=MessageRole.ASSISTANT),
            to_attr="prefetched_ai_messages"
        )

        if user.role == UserRole.ADMIN:
            qs = Message.objects.filter(
                role=MessageRole.USER,
                session__is_archived=False,
            ).select_related("session", "session__user").prefetch_related(ai_responses_prefetch)
        else:
            qs = Message.objects.filter(
                role=MessageRole.USER,
                session__user=user,
                session__is_archived=False,
            ).select_related("session").prefetch_related(ai_responses_prefetch)

        # Search in content
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(content__icontains=search)

        # Date range filters
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        # Filter by session
        session_id = self.request.query_params.get("session")
        if session_id:
            qs = qs.filter(session__id=session_id)

        # Favorites only
        if self.request.query_params.get("favorites") == "true":
            # Get user messages whose AI responses are favourited
            user = cast(User, self.request.user)
            fav_msg_ids = Message.objects.filter(
                role=MessageRole.ASSISTANT,
                session__user=user,
                is_favorite=True,
            ).values_list("id", flat=True)
            qs = qs.filter(
                Q(is_favorite=True) | Q(session__messages__id__in=fav_msg_ids)
            ).distinct()

        return qs.order_by("-created_at")


# ---------------------------------------------------------------------------
# Phase 3: Saved Searches
# ---------------------------------------------------------------------------


class SavedSearchListCreateView(generics.ListCreateAPIView):
    """List and create saved searches."""

    serializer_class = SavedSearchSerializer

    def get_queryset(self):
        user = cast(User, self.request.user)
        return SavedSearch.objects.filter(user=user)

    def perform_create(self, serializer):
        user = cast(User, self.request.user)
        serializer.save(user=user)


class SavedSearchDetailView(generics.RetrieveDestroyAPIView):
    """Retrieve or delete a saved search."""

    serializer_class = SavedSearchSerializer

    def get_queryset(self):
        user = cast(User, self.request.user)
        return SavedSearch.objects.filter(user=user)


# ---------------------------------------------------------------------------
# Phase 3: Export
# ---------------------------------------------------------------------------


class ExportChatView(APIView):
    """Export a chat session as JSON or Markdown."""

    def get(self, request, session_id):
        fmt = request.query_params.get("format", "json")

        try:
            if request.user.role == UserRole.ADMIN:
                session = ChatSession.objects.get(id=session_id)
            else:
                session = ChatSession.objects.get(id=session_id, user=request.user)
        except ChatSession.DoesNotExist:
            return Response(
                {"detail": "Chat session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        messages = Message.objects.filter(session=session).order_by("created_at")

        if fmt == "markdown":
            lines = [
                f"# {session.title}\n",
                f"*Exported on {session.created_at.isoformat()}*\n\n---\n",
            ]
            for msg in messages:
                role = "**You**" if msg.role == "user" else "**Assistant**"
                lines.append(f"\n{role}  \n{msg.content}\n")
                if msg.sources:
                    lines.append("\n<details><summary>Sources</summary>\n")
                    for src in msg.sources:
                        lines.append(
                            f"- {src.get('document_name', '?')} (score {src.get('score', '?')})\n"
                        )
                    lines.append("</details>\n")

            content = "".join(lines)
            response = HttpResponse(
                content, content_type="text/markdown; charset=utf-8"
            )
            response["Content-Disposition"] = (
                f'attachment; filename="{session.title}.md"'
            )
            return response

        # Default: JSON
        data = {
            "session_id": str(session.id),
            "title": session.title,
            "created_at": session.created_at.isoformat(),
            "messages": [
                {
                    "role": msg.role,
                    "content": msg.content,
                    "tokens_used": msg.tokens_used,
                    "latency_ms": msg.latency_ms,
                    "confidence_score": msg.confidence_score,
                    "sources": msg.sources,
                    "created_at": msg.created_at.isoformat(),
                }
                for msg in messages
            ],
        }
        response = HttpResponse(
            json.dumps(data, indent=2),
            content_type="application/json",
        )
        response["Content-Disposition"] = f'attachment; filename="{session.title}.json"'
        return response


class ExportDocumentsView(APIView):
    """Export user-visible documents as CSV."""

    def get(self, request):
        from apps.documents.models import Document
        user = cast(User, request.user)

        if user.role == UserRole.ADMIN:
            qs = Document.objects.filter(is_deleted=False).select_related("collection", "uploaded_by")
        else:
            qs = Document.objects.filter(uploaded_by=user, is_deleted=False).select_related("collection", "uploaded_by")

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "ID",
                "Filename",
                "Status",
                "Collection",
                "MIME Type",
                "File Size (bytes)",
                "Uploaded By",
                "Created At",
                "Indexed At",
            ]
        )
        for doc in qs.iterator():
            writer.writerow(
                [
                    str(doc.id),
                    doc.original_name,
                    doc.status,
                    doc.collection.name if doc.collection else "",
                    doc.mime_type,
                    doc.file_size,
                    doc.uploaded_by.email if doc.uploaded_by else "",
                    doc.created_at.isoformat(),
                    doc.indexed_at.isoformat() if doc.indexed_at else "",
                ]
            )

        response = HttpResponse(buf.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="documents_export.csv"'
        return response


class GetSuggestionsView(APIView):
    """Generate dynamic suggestions based on chat history and documents."""

    def get(self, request):
        user = cast(User, request.user)

        # 1. Get recent chat history (last 5 user messages)
        recent_messages = (
            Message.objects.filter(session__user=user, role=MessageRole.USER)
            .order_by("-created_at")[:5]
            .values_list("content", flat=True)
        )
        history_text = "\n".join(recent_messages) if recent_messages else "No prior history."

        # 2. Get recent documents (last 5 uploaded)
        recent_docs = (
            Document.objects.filter(uploaded_by=user, is_deleted=False)
            .order_by("-created_at")[:5]
            .values_list("original_name", flat=True)
        )
        docs_text = ", ".join(recent_docs) if recent_docs else "No documents uploaded yet."

        # 3. Call LLM to generate suggestions
        try:
            llm = get_llm(streaming=False)
            prompt = SUGGESTION_GENERATION_PROMPT.format(
                history=history_text, document_titles=docs_text
            )
            
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            
            # Clean response - sometimes LLMs add markdown blocks
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            try:
                suggestions = json.loads(content)
            except json.JSONDecodeError:
                # Fallback if LLM failed to return valid JSON
                suggestions = [
                    "What can you tell me about the uploaded files?",
                    "Summarize my recent documents.",
                    "Help me find specific information.",
                    "What are the key themes in my documents?"
                ]

            return Response(suggestions)

        except Exception as e:
            logger.error("suggestion_generation_failed", error=str(e))
            # Safe fallback
            return Response([
                "How can I help you today?",
                "Tell me about the documents I uploaded.",
                "Summarize the latest report.",
                "What are the main topics in our history?"
            ])
