"""Metadata extraction — extract structured metadata from parsed documents."""

import re
from datetime import datetime
from typing import Optional

import structlog

logger = structlog.get_logger(__name__)


def extract_metadata(
    text: str,
    filename: str,
    mime_type: str,
    parser_metadata: dict,
) -> dict:
    """Extract structured metadata from document text and parser output.

    Returns:
        dict with keys: title, author, date, language, word_count,
        summary_preview, detected_topics
    """
    metadata = {
        "title": _extract_title(text, filename),
        "author": _extract_author(text),
        "date": _extract_date(text),
        "language": _detect_language(text),
        "word_count": len(text.split()),
        "char_count": len(text),
        "summary_preview": _generate_preview(text),
        "detected_topics": _extract_topics(text),
    }

    # Merge parser-provided metadata (page_count, etc.)
    metadata.update(parser_metadata)

    return metadata


def _extract_title(text: str, filename: str) -> str:
    """Try to extract a title from the first lines of the document."""
    lines = text.strip().split("\n")
    for line in lines[:5]:
        cleaned = line.strip().strip("#").strip()
        if cleaned and 5 < len(cleaned) < 150:
            return cleaned
    # Fallback: filename without extension
    name = filename.rsplit(".", 1)[0]
    return name.replace("_", " ").replace("-", " ").title()


def _extract_author(text: str) -> Optional[str]:
    """Look for author patterns in the document."""
    patterns = [
        r"(?:Author|Written by|Prepared by|Created by)[:\s]+([A-Z][a-zA-Z\s\-]+)",
        r"(?:By)[:\s]+([A-Z][a-zA-Z\s\-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text[:2000])
        if match:
            author = match.group(1).strip()
            if len(author) < 60:
                return author
    return None


def _extract_date(text: str) -> Optional[str]:
    """Try to find a date in the document header."""
    patterns = [
        r"(?:Date|Updated|Published|Created)[:\s]+(\d{4}[-/]\d{1,2}[-/]\d{1,2})",
        r"(?:Date|Updated|Published|Created)[:\s]+(\w+ \d{1,2},? \d{4})",
        r"\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text[:3000])
        if match:
            return match.group(1).strip()
    return None


def _detect_language(text: str) -> str:
    """Basic language detection from character frequency."""
    sample = text[:5000].lower()
    # Simple heuristic: check for common English words
    english_indicators = ["the ", "and ", "is ", "of ", "to ", "in ", "for "]
    matches = sum(1 for word in english_indicators if word in sample)
    if matches >= 3:
        return "en"
    return "unknown"


def _generate_preview(text: str, max_length: int = 300) -> str:
    """Generate a short preview / summary from the beginning of the doc."""
    # Skip headers/metadata, find first substantial paragraph
    lines = text.strip().split("\n")
    for line in lines:
        cleaned = line.strip().strip("#").strip()
        if len(cleaned) > 50:
            return cleaned[:max_length] + ("..." if len(cleaned) > max_length else "")
    # Fallback
    return text[:max_length].strip() + "..."


def _extract_topics(text: str) -> list[str]:
    """Extract likely topic keywords from headings and structure."""
    topics = set()

    # Extract markdown headings
    headings = re.findall(r"^#{1,3}\s+(.+)$", text, re.MULTILINE)
    for heading in headings[:15]:
        cleaned = heading.strip().strip("#").strip()
        if 3 < len(cleaned) < 60:
            topics.add(cleaned)

    # Extract bold terms (likely important)
    bold_terms = re.findall(r"\*\*([^*]+)\*\*", text[:5000])
    for term in bold_terms[:10]:
        if 3 < len(term) < 40:
            topics.add(term)

    return sorted(topics)[:10]
