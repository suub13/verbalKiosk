"""
Lazy-initialized OpenAI client.
Mirrors server/src/services/openaiClient.ts
"""
import os
from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def get_openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return _client
