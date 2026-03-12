"""
Session validation helper.
Mirrors server/src/middleware/sessionValidator.ts
"""
import time
from fastapi import HTTPException
from services.session_store import session_store


async def validate_session(session_id: str):
    if not session_id:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "MISSING_SESSION", "message": "Session ID is required"},
        })

    session = await session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error": {"code": "SESSION_NOT_FOUND", "message": "Session not found or expired"},
        })

    if int(time.time() * 1000) > session.expires_at:
        await session_store.delete(session_id)
        raise HTTPException(status_code=410, detail={
            "success": False,
            "error": {"code": "SESSION_EXPIRED", "message": "Session has expired"},
        })

    await session_store.touch(session_id)
    return session
