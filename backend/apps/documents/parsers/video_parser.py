"""Video parser using Gemini Multimodal capabilities."""

import structlog
from django.conf import settings
from google import genai
from google.genai import types

from apps.documents.parsers.base import BaseParser, ParsedDocument

logger = structlog.get_logger(__name__)


class VideoParser(BaseParser):
    """Parser that uses Gemini to analyze and transcribe video files."""

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
        """Use Gemini to analyze visual and audio content of the video."""
        try:
            with open(file_path, "rb") as f:
                video_data = f.read()

            mime_type = "video/mp4" # Default
            if file_path.endswith(".avi"):
                mime_type = "video/x-msvideo"
            elif file_path.endswith(".mov"):
                mime_type = "video/quicktime"

            prompt = (
                "Analyze this video and provide a comprehensive description of both the visual "
                "and audio content. Transcribe all spoken words. Describe key scenes, objects, "
                "and actions. Summarize the overall content for a search index."
            )

            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    types.Part.from_bytes(data=video_data, mime_type=mime_type),
                    prompt,
                ],
            )

            text = response.text if response.text else "Video could not be analyzed."

            return ParsedDocument(
                text=text,
                metadata={
                    "parser": "VideoParser",
                    "model": self.model,
                    "mime_type": mime_type,
                },
                page_count=1,
            )
        except Exception as e:
            logger.error("video_parsing_failed", error=str(e), path=file_path)
            # Note: For very large videos, Gemini API might require file upload first 
            # via File API. For MVP, we pass bytes if small, but let's warn.
            if "limit" in str(e).lower() or "size" in str(e).lower():
                 raise ValueError(f"Video file too large for direct processing: {str(e)}")
            raise ValueError(f"Failed to process video: {str(e)}") from e

    def supports(self, mime_type: str) -> bool:
        return mime_type.startswith("video/")
