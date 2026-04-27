import contextlib
import os
import uuid
from typing import cast

import structlog
from django.conf import settings
from django.db.models import Count, Q
from django.http import FileResponse
from rest_framework import generics, parsers, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.models import Collection, Document, DocumentStatus, Tag
from apps.documents.serializers import (
    CollectionSerializer,
    DocumentDetailSerializer,
    DocumentListSerializer,
    DocumentUploadSerializer,
    TagSerializer,
)
from apps.users.models import User, UserRole
from apps.users.permissions import IsEditorOrAdmin

logger = structlog.get_logger(__name__)


class DocumentUploadView(APIView):
    """Upload a document for RAG processing."""

    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)
    parser_classes = (parsers.MultiPartParser, parsers.FormParser)

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        collection_id = serializer.validated_data.get("collection")

        # Generate unique filename
        ext = os.path.splitext(uploaded_file.name)[1]
        unique_filename = f"{uuid.uuid4().hex}{ext}"
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, unique_filename)

        # Save file to disk
        with open(file_path, "wb+") as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        # Compute checksum
        uploaded_file.seek(0)
        checksum = Document.compute_checksum(uploaded_file)

        # Get collection if provided
        collection = None
        if collection_id:
            with contextlib.suppress(Collection.DoesNotExist):
                collection = Collection.objects.get(
                    id=collection_id, owner=request.user
                )

        # Create document record
        document = Document.objects.create(
            filename=unique_filename,
            original_name=uploaded_file.name,
            file_path=file_path,
            file_size=uploaded_file.size,
            mime_type=uploaded_file.content_type,
            checksum=checksum,
            status=DocumentStatus.PENDING,
            collection=collection,
            uploaded_by=request.user,
        )

        # Queue async processing
        from django_q.tasks import async_task

        async_task(
            "apps.documents.tasks.process_document",
            str(document.id),
            task_name=f"process-{document.original_name}",
        )

        logger.info(
            "document_uploaded",
            document_id=str(document.id),
            filename=uploaded_file.name,
            size=uploaded_file.size,
            user=request.user.email,
        )

        return Response(
            DocumentListSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )


class DocumentListView(generics.ListAPIView):
    """List documents with filtering."""

    serializer_class = DocumentListSerializer

    def get_queryset(self):
        user = cast(User, self.request.user)
        if user.role == UserRole.ADMIN:
            queryset = Document.objects.filter(is_deleted=False)
        else:
            queryset = Document.objects.filter(uploaded_by=user, is_deleted=False)
            
        queryset = queryset.select_related("collection", "uploaded_by").prefetch_related("tags")

        # Filters
        collection_id = self.request.query_params.get("collection")
        if collection_id:
            queryset = queryset.filter(collection_id=collection_id)

        doc_status = self.request.query_params.get("status")
        if doc_status:
            queryset = queryset.filter(status=doc_status)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(original_name__icontains=search)

        return queryset

class DocumentDetailView(generics.RetrieveDestroyAPIView):
    """Get or delete a specific document."""

    serializer_class = DocumentDetailSerializer

    def get_queryset(self):
        user = cast(User, self.request.user)
        if user.role == UserRole.ADMIN:
            return Document.objects.filter(is_deleted=False).prefetch_related("chunks", "tags")
        return Document.objects.filter(
            uploaded_by=user,
            is_deleted=False,
        ).prefetch_related("chunks", "tags")

    def perform_destroy(self, instance):
        """Soft delete — mark as deleted and remove from Chroma."""
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

        # Remove from vector store
        from apps.rag.services.vector_store import delete_by_document_id

        try:
            delete_by_document_id(str(instance.id))
        except Exception as e:
            logger.error(
                "chroma_delete_failed", document_id=str(instance.id), error=str(e)
            )

        logger.info("document_deleted", document_id=str(instance.id))


class DocumentDownloadView(APIView):
    """Download the original document file."""

    def get(self, request, pk):
        try:
            document = Document.objects.get(
                id=pk,
                uploaded_by=request.user,
                is_deleted=False,
            )
        except Document.DoesNotExist:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not os.path.exists(document.file_path):
            return Response(
                {"detail": "File not found on disk."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            open(document.file_path, "rb"),
            as_attachment=True,
            filename=document.original_name,
        )


# ---------- Collections ----------


class CollectionListCreateView(generics.ListCreateAPIView):
    """List or create document collections."""

    serializer_class = CollectionSerializer
    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def get_queryset(self):
        user = cast(User, self.request.user)
        return Collection.objects.filter(owner=user).annotate(
            document_count=Count("documents", filter=Q(documents__is_deleted=False))
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class CollectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a collection."""

    serializer_class = CollectionSerializer
    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def get_queryset(self):
        user = cast(User, self.request.user)
        return Collection.objects.filter(owner=user)


# ---------- Tags ----------


class TagListCreateView(generics.ListCreateAPIView):
    """List or create tags."""

    serializer_class = TagSerializer
    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def get_queryset(self):
        user = cast(User, self.request.user)
        return Tag.objects.filter(owner=user)

    def perform_create(self, serializer):
        user = cast(User, self.request.user)
        serializer.save(owner=user)


class TagDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a tag."""

    serializer_class = TagSerializer
    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def get_queryset(self):
        user = cast(User, self.request.user)
        return Tag.objects.filter(owner=user)


# ---------- Reprocess / Bulk Operations ----------


class DocumentReprocessView(APIView):
    """Re-index a document (re-parse, re-chunk, re-embed)."""

    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def post(self, request, pk):
        try:
            document = Document.objects.get(
                id=pk,
                uploaded_by=request.user,
                is_deleted=False,
            )
        except Document.DoesNotExist:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not os.path.exists(document.file_path):
            return Response(
                {"detail": "Original file no longer exists on disk."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reset status and queue for reprocessing
        document.status = DocumentStatus.PENDING
        document.error_message = ""
        document.save(update_fields=["status", "error_message"])

        from django_q.tasks import async_task

        async_task(
            "apps.documents.tasks.process_document",
            str(document.id),
            task_name=f"reprocess-{document.original_name}",
        )

        logger.info("document_reprocess_queued", document_id=str(document.id))
        return Response(
            DocumentListSerializer(document).data,
            status=status.HTTP_202_ACCEPTED,
        )


class DocumentBulkActionView(APIView):
    """Bulk operations on multiple documents."""

    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def post(self, request):
        action = request.data.get("action")
        document_ids = request.data.get("document_ids", [])

        if not action or not document_ids:
            return Response(
                {"detail": "Both 'action' and 'document_ids' are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        documents = Document.objects.filter(
            id__in=document_ids,
            uploaded_by=request.user,
            is_deleted=False,
        )

        if action == "delete":
            count = documents.count()
            for doc in documents:
                doc.is_deleted = True
                doc.save(update_fields=["is_deleted"])
                from apps.rag.services.vector_store import delete_by_document_id

                try:
                    delete_by_document_id(str(doc.id))
                except Exception as e:
                    logger.error(
                        "bulk_delete_chroma_error", doc_id=str(doc.id), error=str(e)
                    )
            return Response({"detail": f"{count} documents deleted."})

        elif action == "reprocess":
            from django_q.tasks import async_task

            count = 0
            for doc in documents.filter(
                status__in=[DocumentStatus.ERROR, DocumentStatus.INDEXED]
            ):
                if os.path.exists(doc.file_path):
                    doc.status = DocumentStatus.PENDING
                    doc.error_message = ""
                    doc.save(update_fields=["status", "error_message"])
                    async_task(
                        "apps.documents.tasks.process_document",
                        str(doc.id),
                        task_name=f"reprocess-{doc.original_name}",
                    )
                    count += 1
            return Response({"detail": f"{count} documents queued for reprocessing."})

        elif action == "move_collection":
            collection_id = request.data.get("collection_id")
            if collection_id:
                try:
                    collection = Collection.objects.get(
                        id=collection_id, owner=request.user
                    )
                except Collection.DoesNotExist:
                    return Response(
                        {"detail": "Collection not found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                documents.update(collection=collection)
            else:
                documents.update(collection=None)
            return Response({"detail": f"{documents.count()} documents moved."})

        return Response(
            {"detail": f"Unknown action: {action}"},
            status=status.HTTP_400_BAD_REQUEST,
        )


class DocumentUpdateView(APIView):
    """Update document metadata — tags, collection assignment."""

    permission_classes = (permissions.IsAuthenticated, IsEditorOrAdmin)

    def patch(self, request, pk):
        try:
            document = Document.objects.get(
                id=pk,
                uploaded_by=request.user,
                is_deleted=False,
            )
        except Document.DoesNotExist:
            return Response(
                {"detail": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Update collection
        if "collection" in request.data:
            coll_id = request.data["collection"]
            if coll_id:
                try:
                    collection = Collection.objects.get(id=coll_id, owner=request.user)
                    document.collection = collection
                except Collection.DoesNotExist:
                    return Response(
                        {"detail": "Collection not found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
            else:
                document.collection = None
            document.save(update_fields=["collection"])

        # Update tags
        if "tag_ids" in request.data:
            tag_ids = request.data["tag_ids"]
            tags = Tag.objects.filter(id__in=tag_ids, owner=request.user)
            document.tags.set(tags)

        return Response(DocumentDetailSerializer(document).data)
