from django.contrib import admin

from apps.documents.models import Collection, Document, DocumentChunk, Tag


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "original_name",
        "status",
        "file_size",
        "mime_type",
        "uploaded_by",
        "created_at",
    )
    list_filter = ("status", "mime_type", "created_at")
    search_fields = ("original_name", "uploaded_by__email")
    readonly_fields = ("checksum", "file_path", "filename")


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_default", "created_at")
    list_filter = ("is_default",)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "color")


@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "chunk_index", "token_count")
    list_filter = ("document",)
