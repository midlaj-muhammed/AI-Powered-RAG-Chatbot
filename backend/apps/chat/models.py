import uuid

from django.conf import settings
from django.db import models

from utils.models import TimeStampedModel


class MessageRole(models.TextChoices):
    USER = "user", "User"
    ASSISTANT = "assistant", "Assistant"
    SYSTEM = "system", "System"


class ChatSession(TimeStampedModel):
    """A conversation session between a user and the AI assistant."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_sessions",
    )
    title = models.CharField(max_length=255, default="New Chat")
    is_archived = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "chat_sessions"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "-updated_at"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.title}"

    def generate_title(self):
        """Auto-generate title from the first user message."""
        first_message = self.messages.filter(role=MessageRole.USER).first()
        if first_message:
            content = first_message.content[:60]
            self.title = content + "..." if len(first_message.content) > 60 else content
            self.save(update_fields=["title"])


class Message(TimeStampedModel):
    """A single message within a chat session."""

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(
        max_length=10,
        choices=MessageRole.choices,
        db_index=True,
    )
    content = models.TextField()
    tokens_used = models.IntegerField(default=0)
    latency_ms = models.IntegerField(default=0)
    sources = models.JSONField(default=list, blank=True)
    confidence_score = models.FloatField(null=True, blank=True)
    is_favorite = models.BooleanField(default=False)

    class Meta:
        db_table = "messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["session", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"


class MessageAttachment(TimeStampedModel):
    """File attachment for a chat message."""

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="attachments",
        null=True,
        blank=True,
    )
    file = models.FileField(upload_to="chat/attachments/%Y/%m/%d/")
    mime_type = models.CharField(max_length=100)
    file_size = models.BigIntegerField()
    filename = models.CharField(max_length=255)

    class Meta:
        db_table = "message_attachments"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.filename} ({self.mime_type})"


class MessageFeedback(models.Model):
    """Thumbs up/down feedback on AI messages."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.OneToOneField(
        Message,
        on_delete=models.CASCADE,
        related_name="feedback",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    is_helpful = models.BooleanField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "message_feedback"


class SavedSearch(TimeStampedModel):
    """A saved search query the user can quickly re-run."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_searches",
    )
    name = models.CharField(max_length=255)
    query = models.TextField()
    collection = models.CharField(max_length=255, blank=True, default="default")

    class Meta:
        db_table = "saved_searches"
        ordering = ["-created_at"]
        unique_together = ("user", "name")

    def __str__(self):
        return f"{self.user.email} – {self.name}"
