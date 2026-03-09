import requests
import subprocess
import json
import os

BASE_URL = os.getenv("PINO_BASE_URL")

# 본인확인 요청
def identity_verify(providerId:str, userName:str, userBirthday:str, userPhone:str, userRegistSingleNumber:str):
    IDENTITY_VERIFY_URL = f"{BASE_URL}/api/voice/v1/identity/verify"
    
    headers = {
        "Content-Type": "application/json; charset=UTF-8",
    }

    data = {
        "providerId": providerId, # 이동통신사 ID
        "userName": userName,   # 사용자 명
        "userBirthday": userBirthday, # 사용자 생년월일 YYYYMMDD 형식
        "userPhone": userPhone,  # 사용자 핸드폰 번호 (하이픈 제외)
        "userRegistSingleNumber": userRegistSingleNumber  # (사용자 주민번호 뒤 자리 첫번째 숫자)
    }

    resp = requests.post(IDENTITY_VERIFY_URL, headers=headers, data=json.dumps(data), timeout=5)
    resp.raise_for_status()

    if resp.json().get("code") != "100":
        raise Exception(f"인증 실패: {resp.json().get('message')}")
    else:
        print("인증 성공:", resp.json().get("message")) 
        return resp.json() # success 받으면 인증코드로 연결


# 사용자 토큰 요청
def get_token(userToken:str, authNumber:str):
    VERIFY_RESULT_URL = f"{BASE_URL}/api/voice/v1/identity/verify/result"
    
    headers = {
        "Content-Type": "application/json",
    }
    
    data = {
        "userToken": userToken,
        "authNumber": authNumber # SMS 문자로 전달받은 6자리 인증 번호
    }
    
    resp = requests.post(VERIFY_RESULT_URL, headers=headers, data=json.dumps(data), timeout=5)
    resp.raise_for_status()

    if resp.json().get("code") != "100":
        raise Exception(f"토큰 발급 실패: {resp.json().get('message')}")
    else:
        print("토큰 발급 성공:", resp.json().get("message")) 
        return resp.headers.get("accessToken"), resp.headers.get("refreshToken")


# 토큰 갱신
def refresh_token(accessToken:str, refreshToken: str):
    VERIFY_REFRESH_URL = f"{BASE_URL}/api/voice/v1/identity/verify/refresh"

    headers = {
        "Content-Type": "application/json",
        "accessToken": accessToken
    }

    data = {
        "refreshToken": refreshToken
    }

    resp = requests.put(VERIFY_REFRESH_URL, headers=headers, data=json.dumps(data), timeout=5)
    resp.raise_for_status()

    if resp.json().get("code") != "100":
        raise Exception(f"토큰 갱신 실패: {resp.json().get('message')}")
    else:
        print("토큰 갱신 성공:", resp.json().get("message"))
        return resp.headers.get("accessToken"), resp.headers.get("refreshToken")


# 전자증명서 목록 조회
def get_option_list():
    DOC_LIST_URL = f"{BASE_URL}/api/voice/v1/gov/doc/list"

    headers = {
        "Content-Type": "application/json",
    }

    resp = requests.get(DOC_LIST_URL, headers=headers, timeout=5)
    resp.raise_for_status()

    if resp.json().get("code") != "100":
        raise Exception(f"전자 증명서 목록 조회 실패: {resp.json().get('message')}")
    else:
        print("전자 증명서 목록 조회 성공:", resp.json().get("message"))
        return resp.json().get("govDocList", [])  # 전자 증명서 목록 반환


# 전자증명서 신청 가능 여부 조회 및 신청 옵션 확인
def apply_check(access_token: str, gov_doc_id: str):
    APPLY_CHECK_URL = f"{BASE_URL}/api/voice/v1/gov/doc/apply/check"

    headers = {
        "Content-Type": "application/json",
        "accessToken": access_token
    }

    data = {
        "govDocId": gov_doc_id
    }

    resp = requests.post(APPLY_CHECK_URL, headers=headers, data=json.dumps(data), timeout=5)
    resp.raise_for_status()

    if resp.json().get("code") != "100":
        raise Exception(f"신청 가능여부 조회 실패: {resp.json().get('message')}")
    else:
        print("신청 가능여부 조회 성공:", resp.json().get("message"))
        return resp.json().get("applyOptionList", [])  # 옵션 리스트 반환
    

# 전자 증명서 전자 서명 요청
def apply_sign(access_token: str, gov_doc_id: str, providerId: str, userPhone:str, applyOptionList: list):
    APPLY_SIGN_URL = f"{BASE_URL}/api/voice/v1/gov/doc/apply/sign"

    headers = {
        "Content-Type": "application/json",
        "accessToken": access_token
    }

    data = {
        "govDocId": gov_doc_id,
        "providerId": providerId,
        "userPhone": userPhone,
        "applyOptionList": applyOptionList
    }

    resp = requests.post(APPLY_SIGN_URL, headers=headers, data=json.dumps(data), timeout=5)
    resp.raise_for_status()    

    if resp.json().get("code") != "100":
        raise Exception(f"전자증명서 전자 서명 요청 실패: {resp.json().get('message')}")
    else:
        print("전자증명서 전자 서명 요청 성공:", resp.json().get("message"))
        return resp.json().get("signToken", None)  # 옵션 리스트 반환
    

# 전자증명서 신청
def doc_apply(accessToken: str, govDocId: str, signToken:str):
    DOC_APPLY_URL = f"{BASE_URL}/api/voice/v1/gov/doc/apply"

    headers = {
        "Content-Type": "application/json",
        "accessToken": accessToken
    }

    data = {
        "govDocId": govDocId,
        "signToken": signToken
    }

    resp = requests.post(DOC_APPLY_URL, headers=headers, data=json.dumps(data), timeout=5)
    resp.raise_for_status()

    if resp.json().get("code") != "100":
        raise Exception(f"전자증명서 신청 실패: {resp.json().get('message')}")
    else:
        print("전자증명서 신청 성공:", resp.json().get("message"))
        print(resp)
        return resp  # 전자 증명서 목록 반환

