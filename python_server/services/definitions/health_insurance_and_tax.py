"""
Health insurance and tax certificate server definitions.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from services.definitions.types import ServerServiceDefinition

health_insurance_server_definition = ServerServiceDefinition(
    id="health-insurance",
    stt_context_after_function={
        "search_services": "default",
        "get_service_details": "default",
    },
    correction_reask_messages={
        "fill": "사용자가 입력 내용을 거부했습니다. 해당 항목을 즉시 다시 물어보세요.",
    },
    correction_stt_prompts={
        "fill": "form_fill",
    },
    system_prompt_section={
        "ko": """─── 건강보험 자격득실 확인서 발급 절차 ───
1. search_services로 서류를 검색하세요.
2. request_identity_verification으로 본인확인을 진행하세요.
3. 본인확인 완료 후 get_service_details로 서비스 정보를 조회하세요.
4. open_service_form을 호출하여 양식을 표시하세요.
5. set_current_field + fill_form_field로 항목을 채우세요.
6. submit_form으로 제출하세요.""",
        "en": "Health Insurance Qualification Certificate procedure:\n1. search_services → 2. request_identity_verification → 3. get_service_details → 4. open_service_form → 5. fill fields → 6. submit_form",
    },
)

tax_certificate_server_definition = ServerServiceDefinition(
    id="tax-certificate",
    stt_context_after_function={
        "search_services": "default",
        "get_service_details": "default",
    },
    correction_reask_messages={
        "fill": "사용자가 입력 내용을 거부했습니다. 해당 항목을 즉시 다시 물어보세요.",
    },
    correction_stt_prompts={
        "fill": "form_fill",
    },
    system_prompt_section={
        "ko": """─── 납세증명서 발급 절차 ───
1. search_services로 서류를 검색하세요.
2. request_identity_verification으로 본인확인을 진행하세요.
3. 본인확인 완료 후 get_service_details로 서비스 정보를 조회하세요.
4. open_service_form을 호출하여 양식을 표시하세요.
5. set_current_field + fill_form_field로 항목을 채우세요.
6. submit_form으로 제출하세요.""",
        "en": "Tax Payment Certificate procedure:\n1. search_services → 2. request_identity_verification → 3. get_service_details → 4. open_service_form → 5. fill fields → 6. submit_form",
    },
)
