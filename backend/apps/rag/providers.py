"""
LLM Provider Factory for Multiple AI Providers.

Supports multiple LLM providers through a unified interface:
- Groq (fast, free)
- Google Gemini (default)
- OpenAI (with custom base URL)
- Ollama (local)
"""

import structlog
from django.conf import settings
from langchain_core.language_models.chat_models import BaseChatModel

logger = structlog.get_logger(__name__)

# Provider-specific caches
_llm_instances: dict[str, BaseChatModel] = {}


class LLMProvider:
    """Available LLM providers."""

    GROQ = "groq"
    GEMINI = "gemini"
    OPENAI = "openai"
    OLLAMA = "ollama"


def get_llm_provider() -> str:
    """Get the configured LLM provider from settings."""
    return getattr(settings, "LLM_PROVIDER", LLMProvider.GEMINI).lower()


def get_llm(streaming: bool = True) -> BaseChatModel:
    """
    Get an LLM instance based on the configured provider.

    Args:
        streaming: Whether to enable streaming responses

    Returns:
        BaseChatModel instance
    """
    provider = get_llm_provider()
    cache_key = f"{provider}_{streaming}"

    if cache_key in _llm_instances:
        instance = _llm_instances[cache_key]
        # For Groq and OpenAI, we can reuse the same instance
        # For Gemini, we need to ensure streaming setting matches
        if provider != LLMProvider.GEMINI:
            return instance

    # Create new instance based on provider
    if provider == LLMProvider.GROQ:
        llm = _create_groq_llm(streaming)
    elif provider == LLMProvider.GEMINI:
        llm = _create_gemini_llm(streaming)
    elif provider == LLMProvider.OPENAI:
        llm = _create_openai_llm(streaming)
    elif provider == LLMProvider.OLLAMA:
        llm = _create_ollama_llm(streaming)
    else:
        logger.warning("unknown_provider", provider=provider, defaulting_to="gemini")
        llm = _create_gemini_llm(streaming)

    # Cache instance
    _llm_instances[cache_key] = llm

    logger.info(
        "llm_initialized",
        provider=provider,
        model=llm.model if hasattr(llm, "model") else "unknown",
        streaming=streaming,
    )

    return llm


def _create_groq_llm(streaming: bool = True) -> BaseChatModel:
    """Create a Groq LLM instance."""
    from langchain_groq import ChatGroq

    return ChatGroq(
        model=str(getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")),
        api_key=str(getattr(settings, "GROQ_API_KEY", "")),  # type: ignore
        streaming=streaming,
        temperature=float(settings.RAG_CONFIG.get("temperature", 0.3)),
        max_tokens=int(settings.RAG_CONFIG.get("max_output_tokens", 2048)),
    )


def _create_gemini_llm(streaming: bool = True) -> BaseChatModel:
    """Create a Gemini LLM instance (legacy, backward compatibility)."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=str(getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash-exp")),
        google_api_key=str(settings.GOOGLE_API_KEY),
        streaming=streaming,
        temperature=float(settings.RAG_CONFIG.get("temperature", 0.3)),
        max_output_tokens=int(settings.RAG_CONFIG.get("max_output_tokens", 2048)),
        convert_system_message_to_human=True,
    )


def _create_openai_llm(streaming: bool = True) -> BaseChatModel:
    """Create an OpenAI-compatible LLM instance (works with Groq, Together, etc.)."""
    from langchain_openai import ChatOpenAI

    base_url = getattr(settings, "OPENAI_BASE_URL", None)
    model = getattr(settings, "OPENAI_MODEL", "gpt-4o")
    api_key = getattr(settings, "OPENAI_API_KEY", "")

    return ChatOpenAI(
        model=model,
        api_key=api_key,  # type: ignore
        streaming=streaming,
        temperature=float(settings.RAG_CONFIG.get("temperature", 0.3)),
        max_tokens=int(settings.RAG_CONFIG.get("max_output_tokens", 2048)),  # type: ignore
        base_url=base_url if base_url else None,
    )


def _create_ollama_llm(streaming: bool = True) -> BaseChatModel:
    """Create an Ollama LLM instance (local)."""
    try:
        from langchain_ollama import ChatOllama
    except ImportError as err:
        raise ImportError(
            "Ollama provider requires langchain-ollama. "
            "Install it with: pip install langchain-ollama"
        ) from err

    model = getattr(settings, "OLLAMA_MODEL", "llama3.1:8b")
    base_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")

    return ChatOllama(
        model=model,
        streaming=streaming,
        temperature=float(settings.RAG_CONFIG.get("temperature", 0.3)),
        num_predict=int(settings.RAG_CONFIG.get("max_output_tokens", 2048)),
        base_url=base_url if base_url else None,
    )


def clear_llm_cache():
    """Clear cached LLM instances (useful for switching models/providers)."""
    global _llm_instances
    _llm_instances.clear()
    logger.info("llm_cache_cleared")
