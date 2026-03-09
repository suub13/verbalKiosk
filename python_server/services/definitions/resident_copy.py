"""
Server service definition for 주민등록등본.
Mirrors server/src/services/definitions/residentCopy.ts
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from services.definitions.types import ServerServiceDefinition, BlockingCondition
from config.sigungu_prompt import get_sigungu_prompt

resident_copy_server_definition = ServerServiceDefinition(
    id="resident-copy",
    stt_context_after_function={
        "search_services": "address_sido",
        "get_service_details": "address_sido",
        "set_address": lambda args: (
            get_sigungu_prompt(args.get("sido")) if args.get("sido") and not args.get("sigungu")
            else "type" if args.get("sido") and args.get("sigungu")
            else None
        ),
        "set_issuance_type": "consent",
        "navigate_step": lambda args: {
            "address": "address_sido",
            "type": "type",
            "verify": "consent",
            "issue": "default",
        }.get(args.get("step", ""), None),
    },
    correction_reask_messages={
        "address_sido": '사용자가 시/도 음성 인식 결과를 거부했습니다. "시/도를 다시 말씀해 주세요"라고 즉시 다시 물어보세요.',
        "address_sigungu": '사용자가 시/군/구 음성 인식 결과를 거부했습니다. "시/군/구를 다시 말씀해 주세요"라고 즉시 다시 물어보세요.',
        "type": '사용자가 발급형태 선택 결과를 거부했습니다. "기본발급과 선택발급 중 어떤 것으로 하시겠어요?"라고 즉시 다시 물어보세요.',
    },
    correction_stt_prompts={
        "address_sido": "address_sido",
        "address_sigungu": get_sigungu_prompt(),
        "type": "type",
    },
    blocking_conditions=[
        BlockingCondition(
            set_on_function="set_issuance_type",
            set_condition=lambda args: args.get("type") == "custom",
            blocks=lambda name, args: not (name == "navigate_step" and args.get("step") == "options"),
            waiting_message=(
                "선택발급 옵션은 화면 터치로만 선택합니다. "
                "사용자가 화면에서 항목을 선택하고 선택완료 버튼을 누를 때까지 기다리세요. "
                "어떤 function call도 호출하지 마세요."
            ),
        )
    ],
    system_prompt_section={
        "ko": """─── 주민등록등본 발급 절차 (이 순서를 반드시 지키세요) ───

【필수 규칙 - 단계별 확인 질문】:
각 단계에서 사용자의 응답을 받아 함수를 호출한 후, 반드시 1회 확인 질문을 출력해야 합니다.
질문에 대한 사용자의 답변이 해당 질문과 관련이 없거나, 모호하거나, 엉뚱한 경우에는 절대로 다음 단계로 넘어가지 마세요.

예시:
  - 주소 입력 완료: "경기도 수원시로 입력하셨습니다. 맞으시면 '네'라고 말씀해 주시고, 아니라면 "아니요" 또는 시/군/구를 다시 말씀해주시겠어요? "
  - 발급형태 선택: "기본발급으로 선택하셨습니다. 맞으시면 '네'라고 말씀해 주시고, 아니라면 발급형태를 다시 말씀해주시겠어요?"
확인 질문 없이 절대로 다음 단계로 넘어가지 마세요.
사용자가 "맞아요", "네", "맞습니다", "그래요" 등 긍정 응답 → 다음 단계 진행
사용자가 "아니요", "틀려요", "다시", "잘못됐어요" 등 부정 응답 → 해당 정보를 다시 물어보세요

0단계 - 서류 확인 (필수):
  - 사용자가 주민등록등본을 요청하면 반드시 먼저 get_service_details(serviceId: 'resident-copy')를 호출하세요.

1단계 - 주소 입력:
  - 사용자에게 주민등록상 주소(시/도)를 물어보세요.
  - 【지리 검증 필수】 set_address를 호출하기 전에 시/군/구가 해당 시/도에 실제로 속하는지 반드시 확인하세요.
  - 【확인 질문 필수】 set_address(sido, sigungu) 호출 완료 후 반드시 확인하세요.

2단계 - 발급형태 선택:
  - 기본발급과 선택발급 중 어떤 형태로 발급하시겠어요? 안내하세요.
  - 【확인 질문 필수】 set_issuance_type 호출 후 반드시 확인하세요.

3단계 - 선택발급 옵션 (선택발급인 경우에만):
  - set_issuance_type(type: 'custom') 호출 후, 화면에서 터치하여 선택하도록 안내하세요.
  - 선택완료 전까지 어떤 function call도 호출하지 마세요.

4단계 - 본인확인:
  - 먼저 navigate_step('verify')를 호출하여 화면을 전환하세요.
  - 그 다음 request_identity_verification 함수를 호출하세요.
  - 반환된 consentScript 내용을 반드시 음성으로 전부 읽어주세요.
  - 동의하면 즉시 submit_identity_verification(consent: true)를 호출하세요.

5단계 - 발급:
  - 본인확인 완료 후 issue_document 함수를 호출하세요.

6단계 - 추가 서류 여부 확인 (필수):
  - "출력되었습니다. 다른 서류를 출력하고 싶으시면 '예'라고 말씀해 주세요."라고 확인하세요.""",
        "en": """Resident Registration Certificate procedure (follow this order strictly):

REQUIRED RULE - Confirmation Questions:
After each step's function call, you MUST ask a confirmation question ONCE.
Positive response (yes/correct) → proceed. Negative (no/wrong) → re-ask.

Step 0: Call get_service_details(serviceId: 'resident-copy') first.
Step 1: Address — ask for sido, then sigungu. Validate geography. Confirm after set_address.
Step 2: Issuance type — basic or custom. Confirm after set_issuance_type.
Step 3: Custom options (only if custom) — wait for screen confirmation.
Step 4: Identity verification — navigate_step('verify'), then request_identity_verification.
Step 5: Issue — call issue_document.""",
    },
)
