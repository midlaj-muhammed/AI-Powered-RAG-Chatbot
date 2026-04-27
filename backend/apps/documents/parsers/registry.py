"""Parser registry — maps MIME types to parser instances."""

from apps.documents.parsers.base import BaseParser, ParsedDocument
from apps.documents.parsers.docx_parser import DocxParser
from apps.documents.parsers.pdf_parser import PDFParser
from apps.documents.parsers.spreadsheet_parser import CSVParser, XLSXParser
from apps.documents.parsers.text_parser import TextParser
from apps.documents.parsers.vision_parser import VisionParser
from apps.documents.parsers.audio_parser import AudioParser
from apps.documents.parsers.video_parser import VideoParser

_PARSERS: list[BaseParser] = [
    PDFParser(),
    TextParser(),
    DocxParser(),
    CSVParser(),
    XLSXParser(),
    VisionParser(),
    AudioParser(),
    VideoParser(),
]


def parse_document(file_path: str, mime_type: str) -> ParsedDocument:
    """Parse a document using the appropriate parser.

    Raises:
        ValueError: If no parser supports the given MIME type.
    """
    for parser in _PARSERS:
        if parser.supports(mime_type):
            return parser.parse(file_path)
    raise ValueError(f"No parser available for MIME type: {mime_type}")
