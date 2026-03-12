"""
Pino API proxy routes — bridges frontend ↔ external Pino certificate API.

Endpoints:
  GET  /api/pino/doc-list           전자증명서 목록 (useAt=Y 필터)
  POST /api/pino/identity/verify    본인확인 SMS 발송
  POST /api/pino/identity/result    인증번호 확인 & 토큰 발급
  POST /api/pino/apply/check        신청 가능 여부 조회
  POST /api/pino/apply/sign         전자 서명 요청
  POST /api/pino/apply              최종 발급
"""
import json
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional

from services.pino_api import (
    get_doc_list,
    identity_verify,
    get_token,
    apply_check,
    apply_sign,
    doc_apply,
)

router = APIRouter()


# ── 전자증명서 목록 조회 ──────────────────────────────────────────────────────

@router.get("/doc-list")
async def pino_doc_list():
    """
    useAt == 'Y' 인 전자증명서만 반환합니다.
    Response: { success, data: { docs: [{govDocId, govDocNm}] } }
    """
    try:
        docs = get_doc_list()
        return {"success": True, "data": {"docs": docs}}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 본인확인 요청 ─────────────────────────────────────────────────────────────

class IdentityVerifyRequest(BaseModel):
    providerId: str        # 이동통신사 ID
    userName: str          # 사용자 이름
    userBirthday: str      # 생년월일 YYYYMMDD
    userPhone: str         # 핸드폰 번호 (하이픈 제외)
    userRegistSingleNumber: str  # 주민번호 뒷자리 첫 번째 숫자


@router.post("/identity/verify")
async def pino_identity_verify(body: IdentityVerifyRequest):
    """
    본인확인 SMS 발송.
    Response: { success, data: { userToken } }
    """
    try:
        result = identity_verify(
            providerId=body.providerId,
            userName=body.userName,
            userBirthday=body.userBirthday,
            userPhone=body.userPhone,
            userRegistSingleNumber=body.userRegistSingleNumber,
        )
        return {
            "success": True,
            "data": {
                "userToken": result.get("userToken"),
                "message": result.get("message"),
            },
        }
    except Exception as e:
        import traceback, requests as _req
        err_str = str(e)
        # requests.HTTPError includes the response - extract body for debugging
        if hasattr(e, "response") and e.response is not None:
            try:
                err_str = f"Pino API {e.response.status_code}: {e.response.text}"
            except Exception:
                pass
        print(f"[Pino] identity/verify error: {err_str}")
        print(traceback.format_exc())
        return {"success": False, "error": err_str}


# ── 인증번호 확인 & 토큰 발급 ─────────────────────────────────────────────────

class VerifyResultRequest(BaseModel):
    userToken: str
    authNumber: str   # SMS 6자리 인증번호


@router.post("/identity/result")
async def pino_verify_result(body: VerifyResultRequest):
    """
    SMS 인증번호 검증 → accessToken / refreshToken 반환.
    Response: { success, data: { accessToken, refreshToken } }
    """
    try:
        access_token, refresh_token = get_token(body.userToken, body.authNumber)
        return {
            "success": True,
            "data": {
                "accessToken": access_token,
                "refreshToken": refresh_token,
            },
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 신청 가능 여부 조회 ────────────────────────────────────────────────────────

class ApplyCheckRequest(BaseModel):
    govDocId: str


@router.post("/apply/check")
async def pino_apply_check(
    body: ApplyCheckRequest,
    access_token: Optional[str] = Header(None, alias="accessToken"),
):
    """
    전자증명서 신청 가능 여부 및 옵션 조회.
    Response: { success, data: { applyOptionList } }
    """
    if not access_token:
        raise HTTPException(status_code=401, detail={"success": False, "error": "accessToken header required"})
    try:
        option_list = apply_check(access_token, body.govDocId)
        return {"success": True, "data": {"applyOptionList": option_list}}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 전자 서명 요청 ────────────────────────────────────────────────────────────

class ApplySignRequest(BaseModel):
    govDocId: str
    providerId: str
    userPhone: str
    applyOptionList: list


@router.post("/apply/sign")
async def pino_apply_sign(
    body: ApplySignRequest,
    access_token: Optional[str] = Header(None, alias="accessToken"),
):
    """
    전자 서명 요청 → signToken 반환 (이후 외부 인증 필요).
    Response: { success, data: { signToken } }
    """
    if not access_token:
        raise HTTPException(status_code=401, detail={"success": False, "error": "accessToken header required"})
    try:
        sign_token = apply_sign(
            access_token=access_token,
            gov_doc_id=body.govDocId,
            providerId=body.providerId,
            userPhone=body.userPhone,
            applyOptionList=body.applyOptionList,
        )
        return {"success": True, "data": {"signToken": sign_token}}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── 최종 발급 ─────────────────────────────────────────────────────────────────

class DocApplyRequest(BaseModel):
    govDocId: str
    signToken: str


@router.post("/apply")
async def pino_doc_apply(
    body: DocApplyRequest,
    access_token: Optional[str] = Header(None, alias="accessToken"),
):
    """
    외부 인증 완료 후 전자증명서 최종 발급.
    Response: { success, data: <pino response body> }
    """
    if not access_token:
        raise HTTPException(status_code=401, detail={"success": False, "error": "accessToken header required"})
    try:
        result = doc_apply(access_token, body.govDocId, body.signToken)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
