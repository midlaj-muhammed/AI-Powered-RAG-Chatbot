"""Vision parser for images using Gemini."""

import structlog
from django.conf import settings
from google import genai
from google.genai import types

from apps.documents.parsers.base import BaseParser, ParsedDocument

logger = structlog.get_logger(__name__)


class VisionParser(BaseParser):
    """Parser that uses Gemini to describe images for indexing."""

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
        """Use Gemini to generate a detailed description and OCR of the image."""
        try:
            with open(file_path, "rb") as f:
                image_data = f.read()

            prompt = (
                "Provide a detailed description of this image for a search database. "
                "Include all visible text (OCR), objects, people, colors, and context. "
                "Format the output as a coherent text document."
            )

            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    types.Part.from_bytes(data=image_data, mime_type="image/jpeg"), # GenAI handles most images
                    prompt,
                ],
            )

            text = response.text if response.text else "Image could not be described."

            return ParsedDocument(
                text=text,
                metadata={
                    "parser": "VisionParser",
                    "model": self.model,
                },
                page_count=1,
            )
        except Exception as e:
            logger.error("vision_parsing_failed", error=str(e), path=file_path)
            raise ValueError(f"Failed to process image: {str(e)}")

    def supports(self, mime_type: str) -> bool:
        return mime_type.startswith("image/")
