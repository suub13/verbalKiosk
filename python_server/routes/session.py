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
        # ── Pino API: 전자증명서 목록 조회 & 캐시 설정 ───────────────────────
        try:
            from services.pino_api import get_doc_list
            from config.prompts import set_available_docs
            docs = get_doc_list()
            set_available_docs(docs)
            print(f"[Session] Pino 서류 목록 로드 완료: {[d.get('govDocNm') for d in docs]}")
        except Exception as pino_err:
            # Pino API 연결 실패 시 경고만 출력하고 세션은 계속 생성
            print(f"[Session] Pino 서류 목록 조회 실패 (fallback 사용): {pino_err}")
        # ─────────────────────────────────────────────────────────────────────

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
