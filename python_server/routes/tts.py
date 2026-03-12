"""
TTS streaming route.
POST /api/tts - Stream TTS audio using gpt-4o-mini-tts
Mirrors server/src/routes/tts.ts
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from services.openai_client import get_openai
from middleware.session_validator import validate_session

router = APIRouter()

VOICE_MAP = {"ko": "alloy", "en": "nova"}


class TTSRequest(BaseModel):
    sessionId: str
    text: str
    voice: str | None = None
    speed: float = 1.0
    language: str = "ko"


@router.post("")
async def tts(body: TTSRequest):
    await validate_session(body.sessionId)

    if not body.text:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "INVALID_REQUEST", "message": "text is required"},
        })

    selected_voice = body.voice or VOICE_MAP.get(body.language, "alloy")

    try:
        response = await get_openai().audio.speech.create(
            model="gpt-4o-mini-tts",
            voice=selected_voice,  # type: ignore
            input=body.text,
            response_format="pcm",
            speed=body.speed,
        )
        audio_bytes = response.read()
        return Response(
            content=audio_bytes,
            media_type="audio/pcm",
            headers={
                "X-Sample-Rate": "24000",
                "X-Channels": "1",
                "X-Bit-Depth": "16",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "TTS_FAILED", "message": str(e)},
        })
