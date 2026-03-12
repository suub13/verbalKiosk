"""
Transcription route (Service 2 - Cascaded pipeline).
POST /api/transcribe - STT using OpenAI gpt-4o-transcribe
Mirrors server/src/routes/transcribe.ts
"""
import base64
import math
import struct
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from services.openai_client import get_openai
from middleware.session_validator import validate_session

router = APIRouter()

MIN_BYTES = 9600   # 200ms at 24kHz PCM16
MIN_RMS = 0.008


class TranscribeRequest(BaseModel):
    sessionId: str
    audio: str        # base64 PCM16
    language: str = "ko"


def calculate_pcm16_rms(pcm16: bytes) -> float:
    samples = len(pcm16) // 2
    if samples == 0:
        return 0.0
    sum_squares = 0.0
    for i in range(0, len(pcm16) - 1, 2):
        sample = struct.unpack_from("<h", pcm16, i)[0] / 32768.0
        sum_squares += sample * sample
    return math.sqrt(sum_squares / samples)


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
async def transcribe(body: TranscribeRequest):
    await validate_session(body.sessionId)

    if not body.audio:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "INVALID_REQUEST", "message": "audio (base64) is required"},
        })

    audio_buffer = base64.b64decode(body.audio)

    if len(audio_buffer) < MIN_BYTES or calculate_pcm16_rms(audio_buffer) < MIN_RMS:
        return {
            "success": True,
            "data": {"text": "", "language": body.language, "confidence": 0},
        }

    wav_buffer = create_wav_buffer(audio_buffer, 24000, 1, 16)

    try:
        transcription = await get_openai().audio.transcriptions.create(
            model="gpt-4o-transcribe",
            file=("audio.wav", wav_buffer, "audio/wav"),
            language=body.language or "ko",
        )
        return {
            "success": True,
            "data": {
                "text": transcription.text,
                "language": body.language,
                "confidence": 1.0,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "TRANSCRIBE_FAILED", "message": str(e)},
        })
