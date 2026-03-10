"""Query processing — rewriting, expansion, and intent classification."""

import json

import structlog
from langchain_core.messages import HumanMessage

from apps.rag.llm import get_llm

logger = structlog.get_logger(__name__)

QUERY_REWRITE_PROMPT = """You are a query optimizer for a RAG (Retrieval-Augmented Generation) system that searches company documents.

Given the user's query and conversation context, produce a JSON object with:
1. "rewritten": An optimized search query that will retrieve the most relevant document chunks. Remove conversational filler. Expand abbreviations. Add relevant synonyms.
2. "keywords": An array of 3-5 key terms/phrases for keyword-based search.
3. "intent": One of "factual", "summary", "comparison", "list", "how_to", "general".

RULES:
- Keep the rewritten query concise (under 100 words).
- If the query references prior conversation ("it", "that", "those"), resolve the reference using chat history.
- Return ONLY valid JSON, no markdown fences.

Chat history:
{chat_history}

User query: {query}

JSON:"""


def rewrite_query(user_query: str, chat_history: str = "") -> dict:
    """Rewrite a user query for better retrieval.

    Returns:
        dict with keys: rewritten, keywords, intent
    """
    try:
        llm = get_llm(streaming=False)
        prompt = QUERY_REWRITE_PROMPT.format(
            query=user_query,
            chat_history=chat_history or "No previous conversation.",
        )
        response = llm.invoke([HumanMessage(content=prompt)])
        raw = str(response.content).strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]

        result = json.loads(raw)
        logger.info(
            "query_rewritten",
            original=user_query[:80],
            rewritten=result.get("rewritten", "")[:80],
            intent=result.get("intent"),
        )
        return {
            "rewritten": result.get("rewritten", user_query),
            "keywords": result.get("keywords", []),
            "intent": result.get("intent", "general"),
        }
    except Exception as e:
        logger.warning("query_rewrite_failed", error=str(e))
        return {
            "rewritten": user_query,
            "keywords": user_query.split()[:5],
            "intent": "general",
        }


def build_hybrid_query(original: str, rewritten: str, keywords: list[str]) -> str:
    """Combine original and rewritten queries for hybrid search.

    Uses both semantic (rewritten) and keyword matching to improve recall.
    """
    # Deduplicate while preserving order
    parts = [rewritten]
    keyword_str = " ".join(keywords)
    if keyword_str.lower() != rewritten.lower():
        parts.append(keyword_str)
    return " | ".join(parts)
