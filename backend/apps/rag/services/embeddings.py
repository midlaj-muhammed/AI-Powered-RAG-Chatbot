"""
Embedding provider factory.

Supports multiple embedding providers:
- gemini: Google gemini-embedding-2-preview via direct API (default, free tier)
- openai: OpenAI / OpenAI-compatible embeddings
- mock: Deterministic hash-based mock embeddings for offline testing
"""

from typing import Any

import time
import structlog
from django.conf import settings
from langchain_core.embeddings import Embeddings

logger = structlog.get_logger(__name__)

_embeddings_instance: Any = None


def get_embeddings():
    """
    Get an embedding model instance based on EMBEDDING_PROVIDER setting.

    Priority order:
      1. Uses EMBEDDING_PROVIDER env var explicitly
      2. Auto-detects from available API keys
      3. Falls back to deterministic mock (RAG won't be semantic)
    """
    global _embeddings_instance

    if _embeddings_instance is not None:
        return _embeddings_instance

    provider = getattr(settings, "EMBEDDING_PROVIDER", "").lower().strip()
    model = getattr(settings, "EMBEDDING_MODEL", "gemini-embedding-2-preview")
    api_key = getattr(settings, "EMBEDDING_API_KEY", "").strip()

    # Auto-detect provider from available API keys if not explicitly configured
    if not provider:
        google_key = getattr(settings, "GOOGLE_API_KEY", "")
        openai_key = getattr(settings, "OPENAI_API_KEY", "")
        if google_key and not google_key.startswith("your-"):
            provider = "gemini"
        elif openai_key and not openai_key.startswith("your-"):
            provider = "openai"
        else:
            provider = "mock"

    if provider == "gemini":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        # Use EMBEDDING_API_KEY first, then fall back to GOOGLE_API_KEY
        key = api_key or getattr(settings, "GOOGLE_API_KEY", "")
        _embeddings_instance = GoogleGenerativeAIEmbeddings(model=model, google_api_key=key)
    elif provider == "openai":
        key = api_key or getattr(settings, "OPENAI_API_KEY", "")
        _embeddings_instance = _create_openai_embeddings(model, key)
    elif provider == "openrouter":
        key = api_key or getattr(settings, "OPENROUTER_API_KEY", "")
        model = model or getattr(settings, "OPENROUTER_EMBEDDING_MODEL", "google/gemini-embedding-2-preview")
        _embeddings_instance = _create_openrouter_embeddings(model, key)
    else:
        logger.warning(
            "embeddings_using_mock",
            reason=(
                "No valid EMBEDDING_PROVIDER or API key configured. "
                "RAG retrieval will use hash-based mock embeddings and won't "
                "have true semantic search. Set EMBEDDING_PROVIDER=gemini and "
                "GOOGLE_API_KEY in .env for real semantic search."
            ),
        )
        _embeddings_instance = DeterministicMockEmbeddings()

    logger.info("embeddings_initialized", provider=provider, model=model)
    return _embeddings_instance


class GeminiEmbeddings(Embeddings):
    """
    Google Gemini embeddings using the google-genai library.

    Supports multimodal embeddings (text, image, video, audio, PDF)
    mapped into a unified vector space.
    """

    def __init__(self, model: str = "gemini-embedding-2-preview", api_key: str = ""):
        self.model = model
        self.api_key = api_key
        self._client: Any = None

    def _get_client(self):
        """Lazily initialize the Google GenAI client."""
        if self._client is None:
            from google import genai

            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def embed_content(
        self, parts: list[Any], task_type: str = "RETRIEVAL_DOCUMENT"
    ) -> list[float]:
        """
        Embed multimodal content parts.
        Parts can be strings or binary data with mime types.
        """
        client = self._get_client()
        from google.genai import types

        config = types.EmbedContentConfig(task_type=task_type)

        # Convert internal parts to GenAI parts if necessary
        contents: list[Any] = []
        for part in parts:
            if isinstance(part, str):
                contents.append(part)
            elif isinstance(part, dict) and "data" in part and "mime_type" in part:
                contents.append(
                    types.Part.from_bytes(
                        data=part["data"], mime_type=part["mime_type"]
                    )
                )
            else:
                contents.append(part)

                result = client.models.embed_content(
                    model=self.model, contents=contents, config=config
                )

                return result.embeddings[0].values

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple document texts, chunked into batches of 100."""
        client = self._get_client()
        from google.genai import types

        config = types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
        
        all_embeddings: list[list[float]] = []
        batch_size = 90
        
        logger.info("gemini_embedding_batch_start", total_texts=len(texts), batch_size=batch_size)
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            
            # Exponential backoff retry logic for 429s
            max_retries = 8 # More retries for very large files
            for attempt in range(max_retries):
                try:
                    result = client.models.embed_content(
                        model=self.model, contents=batch, config=config
                    )
                    all_embeddings.extend([e.values for e in result.embeddings])
                    
                    # Delay to stay well under free tier RPM
                    # 50 chunks every 2.5 seconds = 1200 chunks per minute
                    # text-embedding-004 has 1500 RPM limit.
                    if i + batch_size < len(texts):
                        time.sleep(2.5) 
                    break
                except Exception as e:
                    error_str = str(e)
                    # Catch rate limit errors (often 429 or containing "quota" or "exhausted")
                    is_rate_limit = any(x in error_str.lower() for x in ["429", "quota", "exhausted", "resource_exhausted"])
                    
                    if is_rate_limit:
                        if attempt == max_retries - 1:
                            fallback_provider = getattr(settings, "EMBEDDING_FALLBACK_PROVIDER", "")
                            if fallback_provider == "openrouter":
                                logger.warning("gemini_embedding_exhausted_switching_to_openrouter", model=self.model)
                                fallback_model = getattr(settings, "OPENROUTER_EMBEDDING_MODEL", self.model)
                                api_key = getattr(settings, "OPENROUTER_API_KEY", self.api_key)
                                fallback_embeddings = _create_openrouter_embeddings(fallback_model, api_key)
                                return fallback_embeddings.embed_documents(batch)
                            
                            logger.error("gemini_embedding_final_failure", error=error_str)
                            raise
                        
                        # Wait exponentially: 10, 20, 40, 60, 60, 60... seconds
                        wait = min((2 ** attempt) * 10, 60)
                        logger.warning("gemini_embedding_rate_limited", attempt=attempt+1, wait=wait, model=self.model)
                        time.sleep(wait)
                    else:
                        logger.error("gemini_embedding_unexpected_error", error=error_str)
                        raise

        return all_embeddings

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query."""
        client = self._get_client()
        from google.genai import types

        config = types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")

        try:
            result = client.models.embed_content(
                model=self.model, contents=text, config=config
            )
            return result.embeddings[0].values
        except Exception as e:
            fallback_provider = getattr(settings, "EMBEDDING_FALLBACK_PROVIDER", "")
            if fallback_provider == "openrouter":
                logger.warning("gemini_embedding_query_failed_switching_to_openrouter", error=str(e))
                fallback_model = getattr(settings, "OPENROUTER_EMBEDDING_MODEL", self.model)
                api_key = getattr(settings, "OPENROUTER_API_KEY", self.api_key)
                fallback_embeddings = _create_openrouter_embeddings(fallback_model, api_key)
                return fallback_embeddings.embed_query(text)
            raise


def _create_openai_embeddings(model: str, api_key: str):
    """Create OpenAI-compatible embedding instance."""
    from langchain_openai import OpenAIEmbeddings

    base_url = getattr(settings, "OPENAI_BASE_URL", None) or None
    return OpenAIEmbeddings(
        model=model or "text-embedding-3-small",
        api_key=api_key,  # type: ignore
        base_url=base_url,
    )


def _create_openrouter_embeddings(model: str, api_key: str):
    """Create OpenRouter-compatible embedding instance."""
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(
        model=model or "google/gemini-embedding-2-preview",
        api_key=api_key,  # type: ignore
        base_url="https://openrouter.ai/api/v1",
    )


class DeterministicMockEmbeddings(Embeddings):
    """
    Deterministic hash-based mock embeddings for offline testing.

    Unlike pure random embeddings, these are consistent: the same text always
    produces the same vector. This makes similarity search work for exact
    duplicate texts, but NOT for semantically similar texts.

    ⚠️  Not suitable for production RAG — use a real embedding model.
    """

    def __init__(self):
        self.dimension = 768

    def _text_to_vector(self, text: str) -> list[float]:
        """Hash text into a deterministic unit vector."""
        import numpy as np

        seed = hash(text) % (2**32)
        rng = np.random.RandomState(seed)
        vec = rng.randn(self.dimension)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._text_to_vector(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._text_to_vector(text)


def clear_embeddings_cache():
    """Clear cached embeddings instance (e.g. after changing provider)."""
    global _embeddings_instance
    _embeddings_instance = None
    logger.info("embeddings_cache_cleared")
