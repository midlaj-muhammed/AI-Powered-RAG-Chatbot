import os

import structlog
from django.conf import settings
from langchain_chroma import Chroma

from apps.rag.embeddings import get_embeddings

logger = structlog.get_logger(__name__)

_vectorstore_instance = None


def get_vectorstore() -> Chroma:
    """Get or create the Chroma vector store instance."""
    global _vectorstore_instance

    if _vectorstore_instance is None:
        persist_dir = settings.CHROMA_PERSIST_DIR
        os.makedirs(persist_dir, exist_ok=True)

        _vectorstore_instance = Chroma(
            collection_name="rag_documents",
            embedding_function=get_embeddings(),
            persist_directory=persist_dir,
        )
        logger.info("vectorstore_initialized", persist_dir=persist_dir)

    return _vectorstore_instance


def add_documents(texts: list[str], metadatas: list[dict], ids: list[str]) -> list[str]:
    """Add document chunks to the vector store."""
    # Validate inputs
    if not texts:
        logger.warning("add_documents_empty_text_list")
        raise ValueError("Cannot add empty text list to vector store")

    # Ensure all texts are strings
    validated_texts = []
    validated_metadatas = []
    validated_ids = []

    for i, (text, metadata, doc_id) in enumerate(zip(texts, metadatas, ids)):
        if text and isinstance(text, str) and text.strip():
            validated_texts.append(text.strip())
            validated_metadatas.append(metadata)
            validated_ids.append(doc_id)
        else:
            logger.warning("add_documents_skipping_empty_chunk", index=i, doc_id=doc_id)

    if not validated_texts:
        logger.warning("add_documents_no_valid_chunks")
        raise ValueError("No valid text chunks to add after filtering")

    vectorstore = get_vectorstore()
    result_ids = vectorstore.add_texts(texts=validated_texts, metadatas=validated_metadatas, ids=validated_ids)
    logger.info("documents_added", count=len(validated_texts))
    return result_ids


def similarity_search(
    query: str,
    k: int = None,
    filter_dict: dict = None,
) -> list:
    """Search for similar documents in the vector store."""
    if k is None:
        k = settings.RAG_CONFIG["top_k"]

    vectorstore = get_vectorstore()
    results = vectorstore.similarity_search_with_relevance_scores(
        query=query,
        k=k,
        filter=filter_dict,
    )

    # Filter by similarity threshold
    threshold = settings.RAG_CONFIG["similarity_threshold"]
    filtered = [(doc, score) for doc, score in results if score >= threshold]

    logger.info(
        "similarity_search",
        query_length=len(query),
        results_total=len(results),
        results_filtered=len(filtered),
    )
    return filtered


def delete_by_document_id(document_id: str) -> None:
    """Remove all chunks for a specific document from the vector store."""
    vectorstore = get_vectorstore()
    # Get all IDs with this document_id in metadata
    results = vectorstore.get(where={"document_id": document_id})
    if results and results["ids"]:
        vectorstore.delete(ids=results["ids"])
        logger.info("documents_deleted", document_id=document_id, count=len(results["ids"]))
