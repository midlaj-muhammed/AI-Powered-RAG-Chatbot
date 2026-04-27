import json
import time
from collections.abc import Generator
from typing import Any

import structlog
from django.conf import settings
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from apps.chat.models import ChatSession, Message, MessageRole
from apps.rag.services.embeddings import get_embeddings
from apps.rag.services.gemini_client import get_llm
from apps.rag.prompts import (
    RAG_SYSTEM_PROMPT,
    RAG_USER_PROMPT,
    TITLE_GENERATION_PROMPT,
    AGENT_SYSTEM_PROMPT,
)
from apps.rag.services.vector_store import similarity_search
from apps.rag.query import rewrite_query, build_hybrid_query
import tiktoken

logger = structlog.get_logger(__name__)

_tiktoken_encoding = None


def _call_llm_with_retry(llm, messages, streaming=True, max_retries=3):
    """Call LLM with retry on rate limit (429) and fallback support."""
    for attempt in range(max_retries):
        try:
            return llm.stream(messages) if streaming else llm.invoke(messages)
        except Exception as e:
            error_str = str(e).lower()
            # Handle rate limits, quotas, and overloaded errors
            is_rate_limit = any(x in error_str for x in ["429", "quota", "limit", "overloaded"])
            
            if is_rate_limit:
                # On final retry, try fallback to OpenRouter if current provider is different
                current_provider = getattr(llm, "provider", "unknown")
                
                # Fallback detection if attribute assignment failed
                if current_provider == "unknown":
                    llm_cls = llm.__class__.__name__.lower()
                    if "groq" in llm_cls:
                        current_provider = "groq"
                    elif "google" in llm_cls:
                        current_provider = "gemini"
                    elif "openai" in llm_cls:
                        current_provider = "openai"
                    elif "openrouter" in llm_cls:
                        current_provider = "openrouter"

                if attempt == max_retries - 1 and current_provider != "openrouter":
                    logger.warning(
                        "llm_exhausted_switching_to_fallback", 
                        provider=current_provider,
                        fallback="openrouter"
                    )
                    fallback_llm = get_llm(streaming=streaming, provider="openrouter")
                    return fallback_llm.stream(messages) if streaming else fallback_llm.invoke(messages)
                
                wait = min(2**attempt * 5, 30)
                logger.warning(
                    "rate_limited_retry",
                    wait_seconds=wait,
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    provider=current_provider
                )
                time.sleep(wait)
                if attempt == max_retries - 1:
                    raise
            else:
                raise


def _count_tokens(text: str, model: str = "gpt-3.5-turbo") -> int:
    """Count tokens in a string using tiktoken."""
    global _tiktoken_encoding
    try:
        if _tiktoken_encoding is None:
            _tiktoken_encoding = tiktoken.encoding_for_model(model)
        encoding = _tiktoken_encoding
        return len(encoding.encode(text))
    except (KeyError, ImportError):
        # Fallback for models not in tiktoken or if tiktoken is missing
        return len(text) // 4

def _build_chat_history(session: ChatSession, max_tokens: int = 15000) -> str:
    """Build chat history string from recent messages, capped by token limit."""
    # Fetch more messages than usual to fill the token window
    messages = session.messages.order_by("-created_at")[:100]
    
    current_tokens = 0
    history_parts = []
    
    for msg in messages:
        role = "Human" if msg.role == MessageRole.USER else "Assistant"
        content = f"{role}: {msg.content}"
        msg_tokens = _count_tokens(content)
        
        if current_tokens + msg_tokens > max_tokens:
            break
            
        history_parts.append(content)
        current_tokens += msg_tokens

    # Reverse to restore chronological order
    return "\n".join(reversed(history_parts)) if history_parts else "No previous conversation."


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
                "score": score,
                "content_preview": doc.page_content[:300],
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
    attachment_ids: list[str] | None = None,
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

        # Check if first message for title generation
        is_first_message = session.messages.filter(role=MessageRole.USER).count() == 1

        # 2. Define Filters for Namespace Segregation
        filter_dict = {"user_id": str(session.user_id)}
        if collection and collection != "default":
            filter_dict["collection_id"] = collection

        # 3. Enhanced Retrieval & Agent Loop
        chat_history = _build_chat_history(session)
        system_content = AGENT_SYSTEM_PROMPT.format(chat_history=chat_history)
        
        # Multimodal Support: Build content parts if images are attached
        content_parts: list[Any] = [
            {"type": "text", "text": f"Question: {user_message}\n\nAvailable metadata filters: {json.dumps(filter_dict)}"}
        ]
        
        # Add image attachments to content parts
        for attachment in attachments:
            if attachment.mime_type.startswith("image/"):
                try:
                    base64_image = _get_base64_file(attachment.file)
                    content_parts.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:{attachment.mime_type};base64,{base64_image}"}
                    })
                    logger.info("multimodal_image_attached", filename=attachment.filename)
                except Exception as e:
                    logger.warning("failed_to_attach_image", error=str(e), filename=attachment.filename)

        current_messages: list[Any] = [
            SystemMessage(content=system_content),
            HumanMessage(content=content_parts)
        ]

        llm = get_llm(streaming=True)
        full_assistant_history = ""
        total_tokens = 0
        all_sources = []
        all_search_results = []  # Raw (doc, score) pairs for confidence calculation
        is_final_phase = False
        
        # Agent Loop (max 3 iterations)
        max_iterations = 3
        for i in range(max_iterations):
            msg_full_content = ""
            # Stream the agent's reasoning/thought with fallback support
            stream = _call_llm_with_retry(llm, current_messages, streaming=True)
            
            # Detect Action: search
            search_query = None
            found_final_answer = False
            
            for chunk in stream:
                if hasattr(chunk, "content") and chunk.content:
                    token = chunk.content
                    msg_full_content += token
                    
                    # Distinguish between Reasoning and Final Answer
                    if "Final Answer:" in msg_full_content:
                        if not is_final_phase:
                            is_final_phase = True
                            # Send the portion after "Final Answer:" in the current chunk
                            parts = msg_full_content.split("Final Answer:", 1)
                            if len(parts) > 1:
                                # We uniquely yield only the new content of the final answer
                                # This handles the case where "Final Answer:" appears mid-chunk
                                final_chunk_part = parts[1]
                                if final_chunk_part:
                                    yield f"data: {json.dumps({'type': 'token', 'content': final_chunk_part})}\n\n"
                        else:
                            # We are already in final phase, just yield the whole chunk
                            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                    else:
                        # Send thoughts to UI with a distinct type
                        yield f"data: {json.dumps({'type': 'thought', 'content': token})}\n\n"
                    
                    # Logic to detect Action: search("...")
                    if 'Action: search("' in msg_full_content and not search_query:
                        start = msg_full_content.find('Action: search("') + 16
                        end = msg_full_content.find('")', start)
                        if end != -1:
                            search_query = msg_full_content[start:end]
                    
                    if "Final Answer:" in msg_full_content:
                        found_final_answer = True

            # Record this turn's tokens
            total_tokens += _count_tokens(msg_full_content)
            full_assistant_history += msg_full_content + "\n"
            
            if search_query:
                # 4. Perform Search
                logger.info("agent_action_search", query=search_query, iteration=i)
                search_results = similarity_search(
                    query=search_query,
                    k=int(settings.RAG_CONFIG["top_k"]),
                    filter_dict=filter_dict,
                )
                
                observation, sources = _build_context(search_results)
                all_sources.extend(sources)
                all_search_results.extend(search_results)  # Keep raw results for confidence
                
                if sources:
                    yield f"data: {json.dumps({'type': 'sources', 'data': sources})}\n\n"
                
                # Update current_messages correctly: AI thought/action followed by User observation
                current_messages.append(AIMessage(content=msg_full_content))
                observation_text = f"Observation: {observation if observation else 'No relevant info found in these documents.'}"
                current_messages.append(HumanMessage(content=observation_text))
                
                # Signal progress to UI (but don't leak raw observation into the answer stream)
                yield f"data: {json.dumps({'type': 'status', 'content': f'Search complete. Found {len(sources)} snippets.'})}\n\n"
            
            elif found_final_answer or i == max_iterations - 1:
                break
            else:
                break

        # 6. Save assistant message (Clean the Final Answer version)
        final_answer_only = full_assistant_history
        if "Final Answer:" in full_assistant_history:
            final_answer_only = full_assistant_history.split("Final Answer:")[-1].strip()
        
        latency_ms = int((time.time() - start_time) * 1000)
        unique_sources = {s['document_id']: s for s in all_sources}.values()
        
        # Calculate real confidence from vector search scores
        confidence = _calculate_confidence(all_search_results) if all_search_results else (0.3 if found_final_answer else 0.1)
        
        assistant_msg = Message.objects.create(
            session=session,
            role=MessageRole.ASSISTANT,
            content=final_answer_only, # Only store the actual answer
            tokens_used=total_tokens,
            latency_ms=latency_ms,
            sources=list(unique_sources),
            confidence_score=confidence,
        )

        # 7. Send completion event
        yield f"data: {json.dumps({'type': 'done', 'message_id': str(assistant_msg.id), 'confidence': assistant_msg.confidence_score, 'latency_ms': latency_ms, 'tokens_used': total_tokens})}\n\n"

        # 8. Generate title AFTER streaming completes (non-blocking for the stream)
        if is_first_message:
            _generate_session_title(session, user_message)

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
        response = _call_llm_with_retry(llm, [HumanMessage(content=prompt)], streaming=False)
        raw_content = response.content
        title_text = str(raw_content).strip().strip('"')[:60]
        session.title = title_text
        session.save(update_fields=["title"])
    except Exception as e:
        # Fallback to truncated question
        session.title = question[:57] + "..." if len(question) > 60 else question
        session.save(update_fields=["title"])
        logger.warning("title_generation_failed", error=str(e))
