"""Base document parser interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ParsedDocument:
    """Represents the extracted text content of a document."""

    text: str
    metadata: dict
    page_count: int = 0


class BaseParser(ABC):
    """Base class for all document parsers."""

    @abstractmethod
    def parse(self, file_path: str) -> ParsedDocument:
        """Extract text content from a file.

        Args:
            file_path: Absolute path to the file on disk.

        Returns:
            ParsedDocument with extracted text, metadata, and page count.
        """
        ...

    @abstractmethod
    def supports(self, mime_type: str) -> bool:
        """Check if this parser supports the given MIME type."""
        ...
