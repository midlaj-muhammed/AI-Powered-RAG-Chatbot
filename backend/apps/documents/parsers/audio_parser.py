"""Audio parser using Gemini Multimodal capabilities."""

import structlog
from django.conf import settings
from google import genai
from google.genai import types

from apps.documents.parsers.base import BaseParser, ParsedDocument

logger = structlog.get_logger(__name__)


class AudioParser(BaseParser):
    """Parser that uses Gemini to transcribe and summarize audio files."""

    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.model = settings.GEMINI_MODEL
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def parse(self, file_path: str) -> ParsedDocument:
        """Use Gemini to transcribe and describe the audio content."""
        try:
            with open(file_path, "rb") as f:
                audio_data = f.read()

            # Determine mime type from extension if not provided, 
            # but usually passed from registry.
            mime_type = "audio/mpeg" 
            if file_path.endswith(".wav"):
                mime_type = "audio/wav"
            elif file_path.endswith(".ogg"):
                mime_type = "audio/ogg"

            prompt = (
                "Please provide a high-quality transcription of this audio. "
                "After the transcription, provide a concise summary of the key points discussed. "
                "The output will be used for indexing in a search database."
            )

            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    types.Part.from_bytes(data=audio_data, mime_type=mime_type),
                    prompt,
                ],
            )

            text = response.text if response.text else "Audio could not be transcribed."

            return ParsedDocument(
                text=text,
                metadata={
                    "parser": "AudioParser",
                    "model": self.model,
                    "mime_type": mime_type,
                },
                page_count=1,
            )
        except Exception as e:
            logger.error("audio_parsing_failed", error=str(e), path=file_path)
            raise ValueError(f"Failed to process audio: {str(e)}") from e

    def supports(self, mime_type: str) -> bool:
        return mime_type.startswith("audio/")
