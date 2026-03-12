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
