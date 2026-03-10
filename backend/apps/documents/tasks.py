"""Async document processing tasks for Django-Q2."""

import structlog
from django.conf import settings
from django.utils import timezone
from langchain.text_splitter import RecursiveCharacterTextSplitter

from apps.documents.models import Document, DocumentChunk, DocumentStatus
from apps.documents.parsers.registry import parse_document
from apps.documents.metadata import extract_metadata
from apps.rag.vectorstore import add_documents, delete_by_document_id

logger = structlog.get_logger(__name__)


def process_document(document_id: str) -> None:
    """Main async task: parse → chunk → embed → store.

    This is called by Django-Q2 as a background task.
    """
    try:
        document = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        logger.error("document_not_found", document_id=document_id)
        return

    if document.is_deleted:
        logger.info("document_deleted_skip", document_id=document_id)
        return

    logger.info(
        "processing_start",
        document_id=document_id,
        filename=document.original_name,
    )

    # Mark as processing
    document.status = DocumentStatus.PROCESSING
    document.save(update_fields=["status"])

    try:
        # Step 1: Parse document
        parsed = parse_document(document.file_path, document.mime_type)
        if not parsed.text.strip():
            raise ValueError("Document contains no extractable text.")

        # Step 1b: Extract metadata
        enriched_metadata = extract_metadata(
            text=parsed.text,
            filename=document.original_name,
            mime_type=document.mime_type,
            parser_metadata=parsed.metadata,
        )
        document.metadata.update(enriched_metadata)
        document.save(update_fields=["metadata"])

        logger.info(
            "parsing_complete",
            document_id=document_id,
            text_length=len(parsed.text),
            page_count=parsed.page_count,
        )

        # Step 2: Chunk the text
        rag_config = settings.RAG_CONFIG
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=rag_config["chunk_size"],
            chunk_overlap=rag_config["chunk_overlap"],
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        chunks = splitter.split_text(parsed.text)

        logger.info(
            "chunking_complete",
            document_id=document_id,
            chunk_count=len(chunks),
        )

        # Step 3: Delete old entries if re-processing
        delete_by_document_id(document_id)
        DocumentChunk.objects.filter(document=document).delete()

        # Step 4: Store chunks in Chroma and database
        texts = []
        metadatas = []
        ids = []
        valid_chunk_index = 0

        for chunk_text in chunks:
            # Skip empty or whitespace-only chunks
            if not chunk_text or not chunk_text.strip():
                continue

            chunk_id = f"{document_id}_chunk_{valid_chunk_index}"
            texts.append(chunk_text.strip())
            metadatas.append({
                "document_id": document_id,
                "document_name": document.original_name,
                "filename": document.original_name,
                "chunk_index": valid_chunk_index,
                "collection_id": str(document.collection_id) if document.collection_id else "",
                "mime_type": document.mime_type,
            })
            ids.append(chunk_id)
            valid_chunk_index += 1

        # Only proceed if we have valid chunks
        if not texts:
            raise ValueError("No valid text chunks found after filtering empty chunks.")

        # Batch add to Chroma
        add_documents(texts=texts, metadatas=metadatas, ids=ids)

        # Save chunk records to database
        chunk_records = [
            DocumentChunk(
                document=document,
                chunk_index=ids.index(chunk_id),
                content=chunk_text,
                token_count=len(chunk_text.split()),
                embedding_id=chunk_id,
            )
            for chunk_text, chunk_id in zip(texts, ids)
        ]
        DocumentChunk.objects.bulk_create(chunk_records)

        # Step 5: Mark as indexed
        actual_chunk_count = len(texts)
        document.status = DocumentStatus.INDEXED
        document.indexed_at = timezone.now()
        document.metadata["chunk_count"] = actual_chunk_count
        document.metadata["total_tokens"] = sum(len(c.split()) for c in texts)
        document.save(update_fields=["status", "indexed_at", "metadata"])

        logger.info(
            "processing_complete",
            document_id=document_id,
            chunk_count=actual_chunk_count,
        )

    except Exception as e:
        document.status = DocumentStatus.ERROR
        document.error_message = str(e)[:500]
        document.save(update_fields=["status", "error_message"])

        logger.error(
            "processing_failed",
            document_id=document_id,
            error=str(e),
        )
        raise
