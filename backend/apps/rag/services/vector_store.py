import os
from typing import Any, List, Optional

import structlog
from django.conf import settings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from qdrant_client.http.exceptions import UnexpectedResponse

from apps.rag.services.embeddings import get_embeddings

logger = structlog.get_logger(__name__)

_vectorstore_instance: Optional[QdrantVectorStore] = None
_client_instance: Optional[QdrantClient] = None

COLLECTION_NAME = "rag_documents"

def get_qdrant_client() -> QdrantClient:
    """Get or create the Qdrant client instance."""
    global _client_instance
    if _client_instance is None:
        url = getattr(settings, "QDRANT_URL", "http://localhost:6333")
        _client_instance = QdrantClient(url=url)
    return _client_instance

def get_vectorstore() -> QdrantVectorStore:
    """Get or create the Qdrant vector store instance."""
    global _vectorstore_instance

    if _vectorstore_instance is None:
        client = get_qdrant_client()
        embeddings = get_embeddings()

        # Ensure collection exists
        try:
            client.get_collection(COLLECTION_NAME)
        except Exception:
            # Create collection if it doesn't exist
            # Note: 3072 is the dimension for gemini-embedding-2-preview
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=rest.VectorParams(
                    size=3072, 
                    distance=rest.Distance.COSINE
                ),
            )
            # Add payload indices for efficient filtering (Namespace Segregation)
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="metadata.user_id",
                field_schema=rest.PayloadSchemaType.KEYWORD,
            )
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="metadata.collection_id",
                field_schema=rest.PayloadSchemaType.KEYWORD,
            )
            logger.info("qdrant_collection_created_and_indexed", collection=COLLECTION_NAME)

        _vectorstore_instance = QdrantVectorStore(
            client=client,
            collection_name=COLLECTION_NAME,
            embedding=embeddings,
        )
        logger.info("vectorstore_initialized", provider="qdrant")

    return _vectorstore_instance


def add_documents(texts: List[str], metadatas: List[dict], ids: List[str]) -> List[str]:
    """Add document chunks to the vector store with metadata for namespace separation."""
    if not texts:
        logger.warning("add_documents_empty_text_list")
        raise ValueError("Cannot add empty text list to vector store")

    vectorstore = get_vectorstore()
    
    # Process in batches
    batch_size = 90
    all_result_ids = []
    
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i : i + batch_size]
        batch_metadatas = metadatas[i : i + batch_size]
        batch_ids = ids[i : i + batch_size]
        
        chunk_ids = vectorstore.add_texts(
            texts=batch_texts, 
            metadatas=batch_metadatas, 
            ids=batch_ids
        )
        all_result_ids.extend(chunk_ids)

    logger.info("documents_added", total_count=len(texts), provider="qdrant")
    return all_result_ids


def similarity_search(
    query: str,
    k: int | None = None,
    filter_dict: dict[str, Any] | None = None,
) -> List[Any]:
    """Search for similar documents with metadata filtering for namespace segregation."""
    search_k = k if k is not None else int(settings.RAG_CONFIG["top_k"])
    threshold = settings.RAG_CONFIG["similarity_threshold"]

    vectorstore = get_vectorstore()
    
    # Explicitly convert filter_dict to Qdrant Filter object to avoid validation errors
    # LangChain's Qdrant wrapper expects rest.Filter for complex scenarios.
    qdrant_filter = None
    if filter_dict:
        must_conditions = []
        for key, value in filter_dict.items():
            must_conditions.append(
                rest.FieldCondition(
                    key=f"metadata.{key}",
                    match=rest.MatchValue(value=value)
                )
            )
        qdrant_filter = rest.Filter(must=must_conditions)

    results = vectorstore.similarity_search_with_relevance_scores(
        query=query,
        k=search_k,
        filter=qdrant_filter,
    )

    filtered = [(doc, score) for doc, score in results if score >= threshold]

    logger.info(
        "similarity_search",
        query_length=len(query),
        results_total=len(results),
        results_filtered=len(filtered),
        provider="qdrant"
    )
    return filtered


def delete_by_document_id(document_id: str) -> None:
    """Remove all chunks for a specific document from the vector store."""
    client = get_qdrant_client()
    
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=rest.Filter(
                must=[
                    rest.FieldCondition(
                        key="metadata.document_id",
                        match=rest.MatchValue(value=document_id)
                    )
                ]
            )
        )
        logger.info("documents_deleted", document_id=document_id, provider="qdrant")
    except UnexpectedResponse as e:
        if "doesn't exist" in str(e) or e.status_code == 404:
            logger.info("delete_skipped_collection_not_found", collection=COLLECTION_NAME)
            return
        raise
    except Exception as e:
        logger.error("delete_failed", error=str(e), document_id=document_id)
