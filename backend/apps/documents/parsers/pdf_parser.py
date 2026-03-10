"""PDF document parser using PyMuPDF (fitz) with PyPDF2 fallback."""

import fitz  # PyMuPDF

from apps.documents.parsers.base import BaseParser, ParsedDocument


class PDFParser(BaseParser):
    SUPPORTED_TYPES = {"application/pdf"}

    def supports(self, mime_type: str) -> bool:
        return mime_type in self.SUPPORTED_TYPES

    def parse(self, file_path: str) -> ParsedDocument:
        doc = fitz.open(file_path)
        pages = []
        for page in doc:
            text = page.get_text("text")
            if text.strip():
                pages.append(text)
        doc.close()

        full_text = "\n\n".join(pages)

        # If pymupdf yields nothing, fallback to PyPDF2
        if not full_text.strip():
            full_text, page_count = self._pypdf2_fallback(file_path)
        else:
            page_count = len(pages)

        metadata = {
            "parser": "pymupdf",
            "page_count": page_count,
        }
        return ParsedDocument(text=full_text, metadata=metadata, page_count=page_count)

    @staticmethod
    def _pypdf2_fallback(file_path: str) -> tuple[str, int]:
        from PyPDF2 import PdfReader

        reader = PdfReader(file_path)
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text)
        return "\n\n".join(pages), len(reader.pages)
