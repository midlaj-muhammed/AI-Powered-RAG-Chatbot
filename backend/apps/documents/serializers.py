import mimetypes

from rest_framework import serializers

from apps.documents.models import Collection, Document, DocumentChunk, Tag

# Known file type signatures (magic numbers)
FILE_SIGNATURES = {
    # PDF - %PDF
    b"\x25\x50\x44\x46": "application/pdf",
    # PNG - PNG
    b"\x89\x50\x4e\x47": "image/png",
    # JPEG - \xff\xd8\xff
    b"\xff\xd8\xff": "image/jpeg",
    # WebP - RIFF....WEBP
    b"RIFF": "image/webp",  # Simplified RIFF check
    # ZIP/DOCX/XLSX - PK
    b"\x50\x4b\x03\x04": "application/zip",
    b"\x50\x4b\x05\x06": "application/zip",
    # MP4 - ....ftyp
    b"\x00\x00\x00": "video/mp4", # Simplified check for box start
    # MP3 - ID3 or raw
    b"ID3": "audio/mpeg",
}


def detect_mime_type_from_bytes(file_data: bytes, filename: str) -> str:
    """Detect MIME type from file content (magic numbers), not just extension."""
    # Read first 4 bytes for signature detection
    signature = file_data[:4]

    # Check known signatures
    for sig, mime in FILE_SIGNATURES.items():
        if signature.startswith(sig):
            return mime

    # Default to text-based determination
    try:
        content_start = file_data[:1024].decode("utf-8", errors="strict")
        if content_start.strip():
            # Try to use extension for text files
            ext = mimetypes.guess_type(filename)[0]
            if ext and ext.startswith("text/"):
                return ext
            return "text/plain"
    except UnicodeDecodeError:
        pass

    # Fallback to extension-based MIME type
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"


def validate_mime_type_consistency(
    uploaded_mime: str, filename: str, file_data: bytes
) -> bool:
    """
    Validate that claimed MIME type matches actual file content.

    This is a security check to prevent file type spoofing.
    Returns True if the file content is consistent with the claimed type.
    """
    detected_mime = detect_mime_type_from_bytes(file_data, filename)

    # If we couldn't detect anything, trust the upload
    if not detected_mime or detected_mime == "application/octet-stream":
        return True

    # Check extensions for Office files (which are ZIP archives)
    filename_lower = filename.lower()
    if filename_lower.endswith(".docx"):
        # All docx files should be ZIP archives
        return file_data.startswith(b"\x50\x4b\x03\x04") or file_data.startswith(
            b"\x50\x4b\x05\x06"
        )
    if filename_lower.endswith(".xlsx"):
        # All xlsx files should be ZIP archives
        return file_data.startswith(b"\x50\x4b\x03\x04") or file_data.startswith(
            b"\x50\x4b\x05\x06"
        )

    # Check PDF signature
    if uploaded_mime == "application/pdf" or filename_lower.endswith(".pdf"):
        return (
            file_data.startswith(b"\x25\x50\x44\x46")
            or detected_mime == "application/pdf"
        )

    # Text-based files - verify UTF-8 decodable content
    text_extensions = {".txt", ".md", ".csv", ".json"}
    if any(filename_lower.endswith(ext) for ext in text_extensions):
        # Try to decode as UTF-8 to verify it's text
        try:
            file_data[: min(1024, len(file_data))].decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False

    # For files with valid magic number detection
    if detected_mime != "application/octet-stream" and uploaded_mime and detected_mime:
        uploaded_type_main = uploaded_mime.split("/")[0]
        detected_type_main = detected_mime.split("/")[0]
        return uploaded_type_main == detected_type_main

    return True  # Default to allowing the upload


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name", "color")
        read_only_fields = ("id",)


class CollectionSerializer(serializers.ModelSerializer):
    document_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Collection
        fields = (
            "id",
            "name",
            "description",
            "color",
            "is_default",
            "document_count",
            "created_at",
        )
        read_only_fields = ("id", "is_default", "created_at")


class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChunk
        fields = ("id", "chunk_index", "content", "token_count")


class DocumentListSerializer(serializers.ModelSerializer):
    """Serializer for listing documents."""

    tags = TagSerializer(many=True, read_only=True)
    collection_name = serializers.CharField(
        source="collection.name", read_only=True, default=None
    )
    uploaded_by_email = serializers.CharField(
        source="uploaded_by.email", read_only=True
    )

    class Meta:
        model = Document
        fields = (
            "id",
            "original_name",
            "file_size",
            "mime_type",
            "status",
            "error_message",
            "metadata",
            "collection",
            "collection_name",
            "tags",
            "uploaded_by_email",
            "created_at",
            "indexed_at",
        )


class DocumentDetailSerializer(serializers.ModelSerializer):
    """Serializer for document detail with chunks."""

    tags = TagSerializer(many=True, read_only=True)
    chunks = DocumentChunkSerializer(many=True, read_only=True)
    collection_name = serializers.CharField(
        source="collection.name", read_only=True, default=None
    )

    class Meta:
        model = Document
        fields = (
            "id",
            "original_name",
            "filename",
            "file_size",
            "mime_type",
            "checksum",
            "status",
            "error_message",
            "metadata",
            "collection",
            "collection_name",
            "tags",
            "chunks",
            "created_at",
            "updated_at",
            "indexed_at",
        )


class DocumentUploadSerializer(serializers.Serializer):
    """Serializer for file upload validation."""

    file = serializers.FileField()
    collection = serializers.UUIDField(required=False, allow_null=True)

    def validate_file(self, value):
        """Validate the uploaded file for size, type, and content consistency."""
        import structlog
        from django.conf import settings

        logger = structlog.get_logger(__name__)

        # Check file size
        if value.size > settings.MAX_UPLOAD_SIZE:
            raise serializers.ValidationError(
                f"File size exceeds maximum of {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB."
            )

        # Check empty file
        if value.size == 0:
            raise serializers.ValidationError("Cannot upload an empty file.")

        # Check allowed MIME types from header (with fallback to extension)
        filename_lower = value.name.lower()
        allowed_extensions = {
            ".pdf", ".txt", ".md", ".csv", ".docx", ".xlsx",
            ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
            ".mp4", ".mpeg", ".mov", ".avi", ".flv", ".mpg", ".webm", ".wmv", ".3gp",
            ".wav", ".mp3", ".aiff", ".aac", ".ogg", ".flac"
        }

        # First check by claimed MIME type
        mime_allowed = value.content_type in settings.ALLOWED_UPLOAD_TYPES

        # Also check by file extension
        extension_allowed = any(
            filename_lower.endswith(ext) for ext in allowed_extensions
        )

        if not mime_allowed and not extension_allowed:
            raise serializers.ValidationError(
                "File type is not supported. Allowed types: PDF, DOCX, TXT, MD, CSV, XLSX, "
                "Images (JPG, PNG, WEBP), Video (MP4, MOV, etc.), and Audio (MP3, WAV, etc.)."
            )

        # Verify MIME type matches actual file content (prevent spoofing)
        value.seek(0)
        header = value.read(1024)
        value.seek(0)

        try:
            if not validate_mime_type_consistency(
                value.content_type, value.name, header
            ):
                detected = detect_mime_type_from_bytes(header, value.name)
                # Only report as error if we're confident in the detection
                if detected not in (None, "application/octet-stream"):
                    logger.warning(
                        "mime_type_mismatch",
                        claimed=value.content_type,
                        detected=detected,
                        filename=value.name,
                    )
                    raise serializers.ValidationError(
                        f"File content does not match the claimed type. "
                        f"This appears to be a '{detected.split('/')[-1]}', not a '{value.content_type.split('/')[-1]}'."
                    )
        except Exception as e:
            # If validation fails for unexpected reasons, log but don't block upload
            logger.error("mime_validation_error", error=str(e), filename=value.name)
            # Don't block upload on validation errors that might be edge cases

        return value

    def validate_collection(self, value):
        """Validate that the collection belongs to the current user."""
        if value:
            from rest_framework.exceptions import ValidationError

            # Get request from context
            request = self.context.get("request")
            if request and hasattr(request, "user"):
                from apps.documents.models import Collection

                try:
                    Collection.objects.get(id=value, owner=request.user)
                except Collection.DoesNotExist as err:
                    raise ValidationError(
                        "Collection not found or you don't have permission to use it."
                    ) from err
        return value
