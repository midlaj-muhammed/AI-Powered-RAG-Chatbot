from django.contrib import admin

from apps.chat.models import ChatSession, Message, MessageFeedback


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = (
        "id",
        "role",
        "content",
        "tokens_used",
        "latency_ms",
        "created_at",
    )


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "is_archived", "created_at", "updated_at")
    list_filter = ("is_archived", "created_at")
    search_fields = ("title", "user__email")
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("session", "role", "short_content", "tokens_used", "created_at")
    list_filter = ("role", "created_at")

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:80]


@admin.register(MessageFeedback)
class MessageFeedbackAdmin(admin.ModelAdmin):
    list_display = ("message", "user", "is_helpful", "created_at")
    list_filter = ("is_helpful",)
