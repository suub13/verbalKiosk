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
        "description": "주민등록등본 발급형태를 설정합니다.",
        "parameters": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["basic", "custom"]},
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
]

def get_error_message(e: Exception) -> str:
    return str(e)
