"""
Pino API client — wraps external electronic certificate (전자증명서) API.
All functions mirror pinoAPI.txt provided by the user.
"""
import os
import json
import requests
from typing import Optional

BASE_URL = os.environ.get("PINO_BASE_URL", os.environ.get("BASE_URL", "")).rstrip("/")

def _check_base_url():
    if not BASE_URL:
        raise Exception(
            "PINO_BASE_URL 환경변수가 설정되지 않았습니다. "            ".env 파일에 PINO_BASE_URL=https://your-pino-server.com 을 추가하세요."
        )


# ── 전자증명서 목록 조회 ──────────────────────────────────────────────────────

def get_doc_list() -> list[dict]:
    """
    전자증명서 전체 목록을 조회한 뒤 useAt == 'Y' 항목만 반환합니다.
    Returns list of dicts: {govDocId, govDocNm}
    """
    url = f"{BASE_URL}/api/voice/v1/gov/doc/list"
    resp = requests.get(url, headers={"Content-Type": "application/json"}, timeout=5)
    resp.raise_for_status()

    body = resp.json()
    if body.get("code") != "100":
        raise Exception(f"전자증명서 목록 조회 실패: {body.get('message')}")

    all_docs: list[dict] = body.get("govDocList", [])
    # useAt == 'Y' 만 필터링
    available = [d for d in all_docs if d.get("useAt") == "Y"]

    return available


# ── 본인확인 요청 ─────────────────────────────────────────────────────────────

def identity_verify(
    providerId: str,
    userName: str,
    userBirthday: str,
    userPhone: str,
    userRegistSingleNumber: str,
) -> dict:
    """
    본인확인 SMS 발송 요청.
    성공 시 resp.json() 반환 (userToken 포함).
    """
    url = f"{BASE_URL}/api/voice/v1/identity/verify"
    data = {
        "providerId": providerId,
        "userName": userName,
        "userBirthday": userBirthday,   # YYYYMMDD
        "userPhone": userPhone,          # 하이픈 제외
        "userRegistSingleNumber": userRegistSingleNumber,  # 주민번호 뒷자리 첫째 숫자
    }
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json; charset=UTF-8"},
        data=json.dumps(data),
        timeout=5,
    )
    resp.raise_for_status()

    body = resp.json()
    if body.get("code") != "100":
        raise Exception(f"본인확인 요청 실패: {body.get('message')}")
    else:
        print(f"[Pino API] 본인확인 요청 성공 → userToken")
    return body  # userToken 포함


# ── 인증번호 확인 & 토큰 발급 ─────────────────────────────────────────────────

def get_token(userToken: str, authNumber: str) -> tuple[str, str]:
    """
    SMS 인증번호 검증 후 accessToken / refreshToken 반환.
    """
    url = f"{BASE_URL}/api/voice/v1/identity/verify/result"
    data = {"userToken": userToken, "authNumber": authNumber}
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        data=json.dumps(data),
        timeout=5,
    )
    resp.raise_for_status()

    body = resp.json()
    if body.get("code") != "100":
        raise Exception(f"토큰 발급 실패: {body.get('message')}")
    else:
        print(f"[Pino API] 토큰 발급 성공 → accessToken, refreshToken")

    access_token = resp.headers.get("accessToken", "")
    refresh_token = resp.headers.get("refreshToken", "")
    return access_token, refresh_token


# ── 토큰 갱신 ────────────────────────────────────────────────────────────────

def refresh_token(accessToken: str, refreshToken: str) -> tuple[str, str]:
    url = f"{BASE_URL}/api/voice/v1/identity/verify/refresh"
    resp = requests.put(
        url,
        headers={"Content-Type": "application/json", "accessToken": accessToken},
        data=json.dumps({"refreshToken": refreshToken}),
        timeout=5,
    )
    resp.raise_for_status()

    body = resp.json()
    if body.get("code") != "100":
        raise Exception(f"토큰 갱신 실패: {body.get('message')}")
    else:
        print(f"[Pino API] 토큰 갱신 성공 → accessToken, refreshToken")

    return resp.headers.get("accessToken", ""), resp.headers.get("refreshToken", "")


# ── 전자증명서 신청 가능 여부 조회 ────────────────────────────────────────────

def apply_check(access_token: str, gov_doc_id: str) -> list[dict]:
    """
    신청 가능 여부 확인 + applyOptionList 반환.
    """
    url = f"{BASE_URL}/api/voice/v1/gov/doc/apply/check"
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json", "accessToken": access_token},
        data=json.dumps({"govDocId": gov_doc_id}),
        timeout=5,
    )
    resp.raise_for_status()

    body = resp.json()
    if body.get("code") != "100":
        raise Exception(f"신청 가능여부 조회 실패: {body.get('message')}")
    else:
        print(f"[Pino API] 신청 가능여부 조회 성공")

    return body.get("applyOptionList", [])


# ── 전자 서명 요청 ────────────────────────────────────────────────────────────

def apply_sign(
    access_token: str,
    gov_doc_id: str,
    providerId: str,
    userPhone: str,
    applyOptionList: list,
) -> Optional[str]:
    """
    전자 서명 요청 → signToken 반환.
    """
    url = f"{BASE_URL}/api/voice/v1/gov/doc/apply/sign"
    data = {
        "govDocId": gov_doc_id,
        "providerId": providerId,
        "userPhone": userPhone,
        "applyOptionList": applyOptionList,
    }
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json", "accessToken": access_token},
        data=json.dumps(data),
        timeout=5,
    )
    resp.raise_for_status()

    body = resp.json()
    if body.get("code") != "100":
        raise Exception(f"전자증명서 서명 요청 실패: {body.get('message')}")
    else:
        print(f"[Pino API] 전자증명서 서명 요청 성공 → signToken")
    return body.get("signToken")


# ── 전자증명서 최종 신청 ──────────────────────────────────────────────────────

def doc_apply(access_token: str, gov_doc_id: str, sign_token: str) -> dict:
    """
    signToken + govDocId 로 전자증명서를 최종 발급합니다.
    """
    url = f"{BASE_URL}/api/voice/v1/gov/doc/apply"
    data = {"govDocId": gov_doc_id, "signToken": sign_token}
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json", "accessToken": access_token},
        data=json.dumps(data),
        timeout=5,
    )
    resp.raise_for_status()

    body = resp.json()
    if body.get("code") != "100":
        raise Exception(f"전자증명서 신청 실패: {body.get('message')}")
    else:
        print(f"[Pino API] 전자증명서 신청 성공")

    return body
