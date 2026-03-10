import hashlib

from django.conf import settings
from django.db import models

from utils.models import TimeStampedModel


class DocumentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    INDEXED = "indexed", "Indexed"
    ERROR = "error", "Error"


class Collection(TimeStampedModel):
    """A group/folder for organizing documents."""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default="#3B82F6")  # hex color
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="collections",
    )
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = "collections"
        unique_together = ("name", "owner")

    def __str__(self):
        return self.name


class Tag(TimeStampedModel):
    """Tags for categorizing documents."""

    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#6B7280")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tags",
    )

    class Meta:
        db_table = "tags"
        unique_together = ("name", "owner")

    def __str__(self):
        return self.name


class Document(TimeStampedModel):
    """An uploaded document for RAG processing."""

    filename = models.CharField(max_length=255)
    original_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField()  # bytes
    mime_type = models.CharField(max_length=100)
    checksum = models.CharField(max_length=64)  # SHA256

    status = models.CharField(
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.PENDING,
        db_index=True,
    )
    error_message = models.TextField(blank=True)

    metadata = models.JSONField(default=dict, blank=True)
    collection = models.ForeignKey(
        Collection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="documents")

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    indexed_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "documents"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["uploaded_by", "status"]),
            models.Index(fields=["uploaded_by", "-created_at"]),
        ]

    def __str__(self):
        return self.original_name

    @staticmethod
    def compute_checksum(file_obj) -> str:
        """Compute SHA256 checksum of a file."""
        sha256 = hashlib.sha256()
        for chunk in file_obj.chunks():
            sha256.update(chunk)
        file_obj.seek(0)  # Reset file pointer
        return sha256.hexdigest()


class DocumentChunk(TimeStampedModel):
    """A text chunk of a document, mirroring Chroma entries."""

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    chunk_index = models.IntegerField()
    content = models.TextField()
    token_count = models.IntegerField(default=0)
    embedding_id = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "document_chunks"
        ordering = ["chunk_index"]
        unique_together = ("document", "chunk_index")

    def __str__(self):
        return f"{self.document.original_name} - Chunk {self.chunk_index}"
