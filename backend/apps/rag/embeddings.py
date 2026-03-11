"""
Embedding provider factory.

Supports multiple embedding providers:
- gemini: Google text-embedding-004 via direct API (default, free tier)
- openai: OpenAI / OpenAI-compatible embeddings
- mock: Deterministic hash-based mock embeddings for offline testing
"""

from typing import Any

import structlog
from django.conf import settings

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
        # Use EMBEDDING_API_KEY first, then fall back to GOOGLE_API_KEY
        key = api_key or getattr(settings, "GOOGLE_API_KEY", "")
        _embeddings_instance = GeminiEmbeddings(model=model, api_key=key)
    elif provider == "openai":
        key = api_key or getattr(settings, "OPENAI_API_KEY", "")
        _embeddings_instance = _create_openai_embeddings(model, key)
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


class GeminiEmbeddings:
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
        """Embed multiple document texts."""
        client = self._get_client()
        from google.genai import types

        config = types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")

        # Batch call
        result = client.models.embed_content(
            model=self.model, contents=texts, config=config
        )

        return [e.values for e in result.embeddings]

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query."""
        client = self._get_client()
        from google.genai import types

        config = types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")

        result = client.models.embed_content(
            model=self.model, contents=text, config=config
        )

        return result.embeddings[0].values


def _create_openai_embeddings(model: str, api_key: str):
    """Create OpenAI-compatible embedding instance."""
    from langchain_openai import OpenAIEmbeddings

    base_url = getattr(settings, "OPENAI_BASE_URL", None) or None
    return OpenAIEmbeddings(
        model=model or "text-embedding-3-small",
        api_key=api_key,  # type: ignore
        base_url=base_url,
    )


class DeterministicMockEmbeddings:
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
