"""Plain text and Markdown parser."""

from apps.documents.parsers.base import BaseParser, ParsedDocument


class TextParser(BaseParser):
    SUPPORTED_TYPES = {"text/plain", "text/markdown"}

    def supports(self, mime_type: str) -> bool:
        return mime_type in self.SUPPORTED_TYPES

    def parse(self, file_path: str) -> ParsedDocument:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()

        lines = text.strip().split("\n")
        metadata = {
            "parser": "text",
            "line_count": len(lines),
        }
        return ParsedDocument(text=text, metadata=metadata, page_count=1)
