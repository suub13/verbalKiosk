"""
Server-side timing constants (in milliseconds).
Mirrors server/src/constants/timings.ts
"""
 
SESSION_TIMINGS = {
    "SILENCE_THRESHOLD_MS": 30_000,
    "DISCONNECT_THRESHOLD_MS": 120_000,
    "ACTIVITY_CHECK_INTERVAL_MS": 10_000,
    "CORRECTION_DEDUP_MS": 2_000,
}
 
# ─── VAD 기본값 ───────────────────────────────────────────────────────────────
# 클라이언트(useVoicePipeline.ts)의 turnDetection과 반드시 동일하게 유지할 것
VAD_DEFAULTS = {
    "type": "server_vad",
    "threshold": 0.6,
    "prefix_padding_ms": 500,
    "silence_duration_ms": 500,
}
 
# options 단계에서 사용하는 낮은 예민도 값
OPTIONS_VAD_THRESHOLD = 0.9
OPTIONS_VAD_SILENCE_MS = 800
 