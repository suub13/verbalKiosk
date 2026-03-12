"""
Shared types, constants, and tool definitions.
"""
from typing import Any

# ── Civil Service Tools (mirrors shared/src/types/civilService.ts) ─────────
CIVIL_SERVICE_TOOLS = [
    {
        "type": "function",
        "name": "search_services",
        "description": "발급 가능한 서류를 검색합니다. Search for documents available for issuance.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "검색어 (한국어 또는 영어)"},
                "category": {"type": "string", "description": "카테고리 ID (선택)"},
            },
            "required": ["query"],
        },
    },
    {
        "type": "function",
        "name": "get_service_details",
        "description": "특정 발급 서류의 상세 정보를 조회합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "serviceId": {"type": "string", "description": "서비스 ID"},
            },
            "required": ["serviceId"],
        },
    },
    {
        "type": "function",
        "name": "check_requirements",
        "description": "서류 발급 요건 및 수수료를 확인합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "serviceId": {"type": "string", "description": "서비스 ID"},
            },
            "required": ["serviceId"],
        },
    },
    {
        "type": "function",
        "name": "open_service_form",
        "description": "서류 발급 양식을 화면에 표시합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "serviceId": {"type": "string"},
                "serviceName": {"type": "string"},
                "fields": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["serviceId", "serviceName", "fields"],
        },
    },
    {
        "type": "function",
        "name": "set_current_field",
        "description": "현재 질문 중인 양식 필드를 화면에서 강조 표시합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "fieldId": {"type": "string"},
            },
            "required": ["fieldId"],
        },
    },
    {
        "type": "function",
        "name": "fill_form_field",
        "description": "양식의 특정 필드에 값을 입력합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "serviceId": {"type": "string"},
                "fieldId": {"type": "string"},
                "value": {"type": "string"},
            },
            "required": ["serviceId", "fieldId", "value"],
        },
    },
    {
        "type": "function",
        "name": "submit_form",
        "description": "작성된 양식을 제출합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "serviceId": {"type": "string"},
            },
            "required": ["serviceId"],
        },
    },
    {
        "type": "function",
        "name": "navigate_step",
        "description": "화면의 진행 단계를 전환합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "step": {
                    "type": "string",
                    "enum": ["address", "type", "options", "verify", "issue"],
                },
            },
            "required": ["step"],
        },
    },
    {
        "type": "function",
        "name": "set_address",
        "description": "주민등록등본 발급을 위한 주민등록상 주소를 설정합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "sido": {"type": "string"},
                "sigungu": {"type": "string"},
            },
            "required": ["sido"],
        },
    },
    {
        "type": "function",
        "name": "set_issuance_type",
        "description": (
            "주민등록등본 발급형태를 설정합니다. "
            "사용자가 '기본발급', '기본으로', '전체 다' 등으로 말하면 type='basic'을 사용하세요. "
            "사용자가 '선택발급', '선택해서', '골라서', '직접 선택' 등으로 말하면 반드시 type='custom'을 사용하세요. "
            "'선택발급'을 'basic'으로 잘못 설정하면 안 됩니다."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["basic", "custom"],
                    "description": "기본발급=basic, 선택발급=custom. 선택발급이라고 하면 반드시 custom.",
                },
            },
            "required": ["type"],
        },
    },
    {
        "type": "function",
        "name": "set_issuance_options",
        "description": "선택발급의 발급 옵션을 음성으로 수집하여 화면에 실시간 반영합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "addressHistoryMode": {"type": "string", "enum": ["all", "custom"]},
                "addressHistoryYears": {"type": "number"},
                "issuanceOptions": {"type": "object"},
                "finalize": {"type": "boolean"},
            },
        },
    },
    {
        "type": "function",
        "name": "issue_document",
        "description": "서류를 최종 발급합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "serviceId": {"type": "string"},
            },
            "required": ["serviceId"],
        },
    },
    {
        "type": "function",
        "name": "request_identity_verification",
        "description": "서류 발급 전 본인확인 절차를 시작합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string"},
            },
            "required": ["reason"],
        },
    },
    {
        "type": "function",
        "name": "submit_identity_verification",
        "description": "개인정보 동의 여부와 전화번호를 제출합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "consent": {"type": "boolean"},
                "phoneNumber": {"type": "string"},
            },
            "required": ["consent", "phoneNumber"],
        },
    },
    {
        "type": "function",
        "name": "reset_workflow",
        "description": "현재 진행 중인 발급 절차를 초기화합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string"},
            },
            "required": ["reason"],
        },
    },
    # ── Pino API: 본인인증 flow ─────────────────────────────────────────────
    {
        "type": "function",
        "name": "pino_request_sms",
        "description": (
            "본인인증 SMS를 발송합니다. "
            "사용자에게 이름, 생년월일(YYYYMMDD), 주민번호 뒷자리 첫 번째 숫자, "
            "이동통신사(SKT/KT/LGU), 휴대폰 번호를 수집한 뒤 호출하세요."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "providerId": {
                    "type": "string",
                    "description": "이동통신사 ID (SKT, KT, LGU, SKTMVNO, KTMVNO, LGUMVNO)",
                },
                "userName": {"type": "string", "description": "사용자 이름"},
                "userBirthday": {"type": "string", "description": "생년월일 YYYYMMDD"},
                "userPhone": {"type": "string", "description": "휴대폰 번호 (하이픈 제외)"},
                "userRegistSingleNumber": {
                    "type": "string",
                    "description": "주민등록번호 뒷자리 첫 번째 숫자 (1~4)",
                },
            },
            "required": ["providerId", "userName", "userBirthday", "userPhone", "userRegistSingleNumber"],
        },
    },
    {
        "type": "function",
        "name": "pino_verify_auth_number",
        "description": "사용자가 입력한 SMS 인증번호를 검증하고 accessToken/refreshToken을 발급받습니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "authNumber": {"type": "string", "description": "SMS로 받은 6자리 인증번호"},
            },
            "required": ["authNumber"],
        },
    },
    {
        "type": "function",
        "name": "pino_apply_check",
        "description": "본인인증 완료 후 선택한 서류의 신청 가능 여부 및 신청 옵션을 조회합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "govDocId": {"type": "string", "description": "발급할 전자증명서 ID"},
            },
            "required": ["govDocId"],
        },
    },
    {
        "type": "function",
        "name": "pino_apply_sign",
        "description": (
            "전자 서명을 요청합니다. 기본발급이면 주민등록상 주소(requiredAt=Y) 옵션만 포함하고, "
            "선택발급이면 사용자가 고른 추가 옵션도 포함하세요. "
            "호출 후 사용자는 외부 앱(예: 네이버)에서 인증을 완료해야 합니다."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "govDocId": {"type": "string", "description": "전자증명서 ID"},
                "applyOptionList": {
                    "type": "array",
                    "description": "apply_check 에서 받은 옵션 리스트 중 선택된 항목",
                    "items": {"type": "object"},
                },
            },
            "required": ["govDocId", "applyOptionList"],
        },
    },
    {
        "type": "function",
        "name": "pino_doc_apply",
        "description": "외부 앱 인증 완료 후 전자증명서를 최종 발급합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "govDocId": {"type": "string", "description": "전자증명서 ID"},
            },
            "required": ["govDocId"],
        },
    },
]

def get_error_message(e: Exception) -> str:
    return str(e)
