"""
Phone number transcription route.
POST /api/transcribe-phone - STT for phone number voice input.
Mirrors server/src/routes/transcribePhone.ts
"""
import base64
import struct
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from services.openai_client import get_openai

router = APIRouter()

MAX_AUDIO_SIZE = 500 * 1024  # 500KB


class TranscribePhoneRequest(BaseModel):
    audio: str  # base64 PCM16
    language: str = "ko"


def create_wav_buffer(pcm16: bytes, sample_rate: int, channels: int, bit_depth: int) -> bytes:
    byte_rate = sample_rate * channels * (bit_depth // 8)
    block_align = channels * (bit_depth // 8)
    data_size = len(pcm16)
    header = bytearray(44)
    header[0:4] = b"RIFF"
    struct.pack_into("<I", header, 4, data_size + 36)
    header[8:12] = b"WAVE"
    header[12:16] = b"fmt "
    struct.pack_into("<I", header, 16, 16)
    struct.pack_into("<H", header, 20, 1)
    struct.pack_into("<H", header, 22, channels)
    struct.pack_into("<I", header, 24, sample_rate)
    struct.pack_into("<I", header, 28, byte_rate)
    struct.pack_into("<H", header, 32, block_align)
    struct.pack_into("<H", header, 34, bit_depth)
    header[36:40] = b"data"
    struct.pack_into("<I", header, 40, data_size)
    return bytes(header) + pcm16


@router.post("")
async def transcribe_phone(body: TranscribePhoneRequest):
    if not body.audio:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "INVALID_REQUEST", "message": "audio (base64) is required"},
        })

    audio_buffer = base64.b64decode(body.audio)

    if len(audio_buffer) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "AUDIO_TOO_LARGE", "message": "Audio exceeds 500KB limit"},
        })

    wav_buffer = create_wav_buffer(audio_buffer, 24000, 1, 16)

    try:
        transcription = await get_openai().audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=("audio.wav", wav_buffer, "audio/wav"),
            language=body.language or "ko",
            prompt="전화번호를 말하고 있습니다. 숫자만 인식해 주세요. 예: 공일공 일이삼사 오육칠팔",
        )
        return {"success": True, "data": {"text": transcription.text}}
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "TRANSCRIBE_FAILED", "message": str(e)},
        })
