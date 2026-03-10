"""
Embedding provider factory.

Supports multiple embedding providers:
- gemini: Google text-embedding-004 via direct API (default, free tier)
- openai: OpenAI / OpenAI-compatible embeddings
- mock: Deterministic hash-based mock embeddings for offline testing
"""

from django.conf import settings
import structlog

logger = structlog.get_logger(__name__)

_embeddings_instance = None


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
    model = getattr(settings, "EMBEDDING_MODEL", "text-embedding-004")
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
    Google Gemini embeddings using the google-ai-generativelanguage library directly.

    This bypasses the langchain_google_genai wrapper which uses v1beta and has
    compatibility issues with text-embedding-004. We call the REST API directly
    using the google-ai-generativelanguage client which supports the v1 endpoint.
    """

    def __init__(self, model: str = "text-embedding-004", api_key: str = ""):
        self.model = model
        self.api_key = api_key
        self._client = None

    def _get_client(self):
        """Lazily initialize the Google AI client."""
        if self._client is None:
            import google.ai.generativelanguage as glm
            import google.auth.credentials

            # Build client with API key transport
            from google.ai.generativelanguage_v1beta import EmbedContentRequest
            from google.ai.generativelanguage_v1beta.services.generative_service import (
                GenerativeServiceClient,
            )
            from google.api_core.gapic_v1 import client_info as client_info_module

            # Use requests-based transport with API key
            self._client = None  # Will use REST calls instead
        return self._client

    def _embed_text(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
        """Embed a single text using the Google AI REST API."""
        import requests

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:embedContent"
        headers = {"Content-Type": "application/json"}
        params = {"key": self.api_key}
        payload = {
            "model": f"models/{self.model}",
            "content": {"parts": [{"text": text}]},
            "taskType": task_type,
        }

        response = requests.post(url, json=payload, headers=headers, params=params, timeout=30)
        if response.status_code != 200:
            raise ValueError(
                f"Error embedding content: {response.status_code} {response.json().get('error', {}).get('message', response.text)}"
            )

        data = response.json()
        return data["embedding"]["values"]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple document texts using RETRIEVAL_DOCUMENT task type."""
        import requests

        # Use batchEmbedContents for efficiency
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:batchEmbedContents"
        headers = {"Content-Type": "application/json"}
        params = {"key": self.api_key}

        requests_payload = [
            {
                "model": f"models/{self.model}",
                "content": {"parts": [{"text": text}]},
                "taskType": "RETRIEVAL_DOCUMENT",
            }
            for text in texts
        ]
        payload = {"requests": requests_payload}

        response = requests.post(url, json=payload, headers=headers, params=params, timeout=60)
        if response.status_code != 200:
            error_msg = response.json().get("error", {}).get("message", response.text)
            raise ValueError(f"Error embedding content: {response.status_code} {error_msg}")

        data = response.json()
        return [emb["values"] for emb in data["embeddings"]]

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query using RETRIEVAL_QUERY task type."""
        return self._embed_text(text, task_type="RETRIEVAL_QUERY")


def _create_openai_embeddings(model: str, api_key: str):
    """Create OpenAI-compatible embedding instance."""
    from langchain_openai import OpenAIEmbeddings

    base_url = getattr(settings, "OPENAI_BASE_URL", None) or None
    kwargs = {
        "model": model or "text-embedding-3-small",
        "api_key": api_key,
    }
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAIEmbeddings(**kwargs)


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

        seed = hash(text) % (2 ** 32)
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
