import re

from rest_framework import serializers

from apps.chat.models import ChatSession, Message, MessageFeedback, SavedSearch


def sanitize_text(text: str) -> str:
    """Basic XSS prevention — strip script tags and dangerous patterns."""
    text = re.sub(
        r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE
    )
    text = re.sub(r"on\w+\s*=\s*[\"'][^\"']*[\"']", "", text, flags=re.IGNORECASE)
    return text.strip()


class AttachmentSerializer(serializers.ModelSerializer):
    """Serializer for message attachments."""

    file_url = serializers.SerializerMethodField()

    class Meta:
        from apps.chat.models import MessageAttachment

        model = MessageAttachment
        fields = ("id", "filename", "mime_type", "file_size", "file_url", "created_at")

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for chat messages."""

    feedback = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = (
            "id",
            "role",
            "content",
            "attachments",
            "tokens_used",
            "latency_ms",
            "sources",
            "confidence_score",
            "is_favorite",
            "feedback",
            "created_at",
        )
        read_only_fields = (
            "id",
            "role",
            "tokens_used",
            "latency_ms",
            "sources",
            "confidence_score",
            "feedback",
            "created_at",
        )

    def get_feedback(self, obj):
        if hasattr(obj, "feedback"):
            try:
                from apps.chat.models import MessageFeedback

                return {
                    "is_helpful": obj.feedback.is_helpful,
                    "comment": obj.feedback.comment,
                }
            except MessageFeedback.DoesNotExist:
                return None
        return None


class ChatSessionListSerializer(serializers.ModelSerializer):
    """Serializer for listing chat sessions."""

    message_count = serializers.IntegerField(read_only=True)
    last_message = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = ChatSession
        fields = (
            "id",
            "title",
            "is_archived",
            "message_count",
            "last_message",
            "user_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "title", "created_at", "updated_at")

    def get_last_message(self, obj):
        # Use annotated fields if available (optimized)
        if hasattr(obj, "last_msg_role") and obj.last_msg_role:
            return {
                "role": obj.last_msg_role,
                "content": obj.last_msg_content[:100] if obj.last_msg_content else "",
                "created_at": obj.last_msg_created_at,
            }
        
        # Fallback to N+1 query (less efficient)
        last = obj.messages.last()
        if last:
            return {
                "role": last.role,
                "content": last.content[:100],
                "created_at": last.created_at,
            }
        return None


class ChatSessionDetailSerializer(serializers.ModelSerializer):
    """Serializer for chat session with all messages."""

    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatSession
        fields = (
            "id",
            "title",
            "is_archived",
            "messages",
            "created_at",
            "updated_at",
        )


class SendMessageSerializer(serializers.Serializer):
    """Serializer for sending a new chat message."""

    MIN_MESSAGE_LENGTH = 3
    MAX_MESSAGE_LENGTH = 5000

    content = serializers.CharField(
        max_length=MAX_MESSAGE_LENGTH,
        min_length=MIN_MESSAGE_LENGTH,
        error_messages={
            "min_length": f"Message must be at least {MIN_MESSAGE_LENGTH} characters.",
            "max_length": f"Message cannot exceed {MAX_MESSAGE_LENGTH} characters.",
            "required": "Message content is required.",
            "blank": "Message cannot be empty.",
        },
    )
    collection = serializers.CharField(required=False, default="default")
    attachment_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )

    def validate_content(self, value):
        """Sanitize and validate message content."""
        # Remove leading/trailing whitespace
        value = value.strip()

        # Check if empty after stripping
        if not value:
            raise serializers.ValidationError(
                "Message cannot be empty or contain only whitespace."
            )

        return sanitize_text(value)

    def validate_collection(self, value):
        """Validate collection identifier."""
        if (
            value
            and isinstance(value, str)
            and not re.match(r"^[a-zA-Z0-9_-]+$", value)
        ):
            raise serializers.ValidationError(
                "Collection name can only contain letters, numbers, hyphens, and underscores."
            )
        return value


class MessageFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for message feedback."""

    class Meta:
        model = MessageFeedback
        fields = ("is_helpful", "comment")


class QueryHistorySerializer(serializers.ModelSerializer):
    """Serializer for query history — user messages with their AI responses."""

    ai_response = serializers.SerializerMethodField()
    session_title = serializers.CharField(source="session.title", read_only=True)
    user_email = serializers.EmailField(source="session.user.email", read_only=True)

    class Meta:
        model = Message
        fields = (
            "id",
            "content",
            "session",
            "session_title",
            "user_email",
            "ai_response",
            "created_at",
        )

    def get_ai_response(self, obj):
        """Get the immediately following assistant response."""
        # Use prefetched messages if available (optimized)
        ai_msg = None
        if hasattr(obj.session, "prefetched_ai_messages"):
            # Find the first assistant message created after this user message
            responses = [
                m for m in obj.session.prefetched_ai_messages 
                if m.created_at > obj.created_at
            ]
            if responses:
                # Assuming chronological order in prefetched list
                ai_msg = min(responses, key=lambda x: x.created_at)
        
        if not ai_msg:
            # Fallback to N+1 query
            ai_msg = (
                Message.objects.filter(
                    session=obj.session,
                    role="assistant",
                    created_at__gt=obj.created_at,
                )
                .order_by("created_at")
                .first()
            )
            
        if ai_msg:
            return {
                "id": str(ai_msg.id),
                "content_preview": ai_msg.content[:200],
                "confidence_score": ai_msg.confidence_score,
                "tokens_used": ai_msg.tokens_used,
                "latency_ms": ai_msg.latency_ms,
                "sources_count": len(ai_msg.sources) if ai_msg.sources else 0,
            }
        return None


class SavedSearchSerializer(serializers.ModelSerializer):
    """Serializer for saved searches."""

    class Meta:
        model = SavedSearch
        fields = ("id", "name", "query", "collection", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
