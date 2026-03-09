"""
Session management routes.
POST /api/session - Create session
DELETE /api/session/{id} - Delete session
Mirrors server/src/routes/session.ts
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.session_store import session_store

router = APIRouter()


class CreateSessionRequest(BaseModel):
    language: str
    serviceType: str


@router.post("")
async def create_session(body: CreateSessionRequest):
    if not body.language or not body.serviceType:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "INVALID_REQUEST", "message": "language and serviceType are required"},
        })
    try:
        session = await session_store.create(body.language, body.serviceType)
        return {
            "success": True,
            "data": {"sessionId": session.id, "expiresAt": session.expires_at},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "SESSION_CREATE_FAILED", "message": str(e)},
        })


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    try:
        await session_store.delete(session_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "SESSION_DELETE_FAILED", "message": str(e)},
        })
