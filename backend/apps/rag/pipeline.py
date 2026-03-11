import json
import time
from collections.abc import Generator

import structlog
from django.conf import settings
from langchain_core.messages import HumanMessage, SystemMessage

from apps.chat.models import ChatSession, Message, MessageRole
from apps.rag.llm import get_llm
from apps.rag.prompts import (
    NO_CONTEXT_RESPONSE,
    RAG_SYSTEM_PROMPT,
    RAG_USER_PROMPT,
    TITLE_GENERATION_PROMPT,
)
from apps.rag.query import build_hybrid_query, rewrite_query
from apps.rag.vectorstore import similarity_search

logger = structlog.get_logger(__name__)


def _call_llm_with_retry(llm, messages, max_retries=3):
    """Call LLM with retry on rate limit (429)."""
    for attempt in range(max_retries):
        try:
            return llm.stream(messages)
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "quota" in error_str.lower():
                wait = min(2**attempt * 5, 30)
                logger.warning(
                    "rate_limited_retry",
                    wait_seconds=wait,
                    attempt=attempt + 1,
                    max_retries=max_retries,
                )
                time.sleep(wait)
                if attempt == max_retries - 1:
                    raise
            else:
                raise


def _build_chat_history(session: ChatSession, limit: int = 10) -> str:
    """Build chat history string from recent messages."""
    recent_messages = session.messages.order_by("-created_at")[:limit]
    ordered_messages = reversed(list(recent_messages))

    history_parts = []
    for msg in ordered_messages:
        role = "Human" if msg.role == MessageRole.USER else "Assistant"
        history_parts.append(f"{role}: {msg.content}")

    return "\n".join(history_parts) if history_parts else "No previous conversation."


def _build_context(search_results: list) -> tuple[str, list[dict]]:
    """Build context string and source references from search results."""
    if not search_results:
        return "", []

    context_parts = []
    sources = []

    for i, (doc, score) in enumerate(search_results):
        metadata = doc.metadata
        doc_name = metadata.get("filename", f"Document {i + 1}")
        chunk_index = metadata.get("chunk_index", 0)

        context_parts.append(
            f"[Source: {doc_name}, Chunk {chunk_index}]\n{doc.page_content}\n"
        )
        sources.append(
            {
                "document_name": doc_name,
                "document_id": metadata.get("document_id", ""),
                "chunk_index": chunk_index,
                "relevance_score": round(score * 100, 1),
                "snippet": doc.page_content[:200],
            }
        )

    return "\n---\n".join(context_parts), sources


def _calculate_confidence(search_results: list) -> float:
    """Calculate confidence score based on search results."""
    if not search_results:
        return 0.0

    scores = [score for _, score in search_results]
    avg_score = sum(scores) / len(scores)
    top_score = max(scores)

    # Weighted: 60% top score, 30% average, 10% count bonus
    count_bonus = min(len(scores) / 5.0, 1.0) * 0.1
    confidence = (top_score * 0.6) + (avg_score * 0.3) + count_bonus

    return round(min(confidence, 1.0), 2)


def stream_chat_response(
    session: ChatSession,
    user_message: str,
    collection: str = "default",
    attachment_ids: list[str] = None,
) -> Generator[str, None, None]:
    """
    Stream an AI response for a user message, supporting multimodal attachments.
    """
    start_time = time.time()
    attachment_ids = attachment_ids or []

    try:
        # 1. Save user message and link attachments
        msg = Message.objects.create(
            session=session,
            role=MessageRole.USER,
            content=user_message,
        )
        
        from apps.chat.models import MessageAttachment
        attachments = MessageAttachment.objects.filter(id__in=attachment_ids)
        attachments.update(message=msg)

        # Auto-generate title on first message
        if session.messages.filter(role=MessageRole.USER).count() == 1:
            _generate_session_title(session, user_message)

        # 2. Build multimodal query if there are images
        search_query = user_message
        image_attachments = [a for a in attachments if a.mime_type.startswith("image/")]
        
        # 3. Retrieve relevant context
        filter_dict = None
        if collection and collection != "default":
            filter_dict = {"collection_id": collection}

        # If we have images, we can use multimodal embeddings for search
        if image_attachments and hasattr(get_embeddings(), "embed_content"):
            # This is a bit complex for standard langchain Chroma
            # For now, we still search with text but we could extend this
            logger.info("multimodal_search_requested", images_count=len(image_attachments))
            
        search_results = similarity_search(
            query=search_query,
            k=int(settings.RAG_CONFIG["top_k"]),
            filter_dict=filter_dict,
        )

        context, sources = _build_context(search_results)
        confidence = _calculate_confidence(search_results)

        # 4. Build messages for the LLM
        system_content = RAG_SYSTEM_PROMPT.format(
            context=context if context else "No relevant documents found.",
            chat_history=_build_chat_history(session),
        )
        
        # Construct multimodal content
        user_content = [{"type": "text", "text": RAG_USER_PROMPT.format(question=user_message)}]
        for attachment in attachments:
            if attachment.mime_type.startswith("image/"):
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{attachment.mime_type};base64,{_get_base64_file(attachment.file)}"}
                })
            # Add other types if supported by the LLM wrapper

        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=user_content),
        ]

        # 5. Stream response from LLM
        llm = get_llm(streaming=True)
        full_response = ""
        tokens_count = 0

        # Send sources first
        if sources:
            yield f"data: {json.dumps({'type': 'sources', 'data': sources})}\n\n"

        stream = _call_llm_with_retry(llm, messages)
        for chunk in stream:
            if hasattr(chunk, "content") and chunk.content:
                token = chunk.content
                full_response += token
                tokens_count += 1
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        # 6. Save assistant message
        latency_ms = int((time.time() - start_time) * 1000)
        assistant_msg = Message.objects.create(
            session=session,
            role=MessageRole.ASSISTANT,
            content=full_response,
            tokens_used=tokens_count,
            latency_ms=latency_ms,
            sources=sources,
            confidence_score=confidence,
        )

        # 7. Send completion event
        yield f"data: {json.dumps({'type': 'done', 'message_id': str(assistant_msg.id), 'confidence': confidence, 'latency_ms': latency_ms, 'tokens_used': tokens_count})}\n\n"

    except Exception as e:
        logger.error("chat_response_error", error=str(e), session_id=str(session.id))
        yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

def _get_base64_file(file_field) -> str:
    """Read a file field and return its base64 encoding."""
    import base64
    with file_field.open("rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def _generate_session_title(session: ChatSession, question: str) -> None:
    """Generate a short title for the chat session."""
    try:
        llm = get_llm(streaming=False)
        prompt = TITLE_GENERATION_PROMPT.format(question=question)
        response = llm.invoke([HumanMessage(content=prompt)])
        raw_content = response.content
        title_text = str(raw_content).strip().strip('"')[:60]
        session.title = title_text
        session.save(update_fields=["title"])
    except Exception as e:
        # Fallback to truncated question
        session.title = question[:57] + "..." if len(question) > 60 else question
        session.save(update_fields=["title"])
        logger.warning("title_generation_failed", error=str(e))
