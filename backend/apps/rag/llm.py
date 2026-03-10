"""
LLM factory wrapper for backward compatibility.

This module provides the simplified get_llm() interface used throughout the codebase.
The actual provider logic is in providers.py.
"""

from .providers import get_llm, clear_llm_cache, LLMProvider

__all__ = ["get_llm", "clear_llm_cache", "LLLMProvider"]
