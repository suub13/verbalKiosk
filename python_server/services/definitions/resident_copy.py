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
        # 본인인증이 먼저이므로 서류 선택 후엔 STT를 default로 유지 (consent 컨텍스트 금지)
        "search_services": "default",
        "get_service_details": "default",
        "set_address": lambda args: (
            get_sigungu_prompt(args.get("sido")) if args.get("sido") and not args.get("sigungu")
            else "type" if args.get("sido") and args.get("sigungu")
            else None
        ),
        "set_issuance_type": "default",
        "navigate_step": lambda args: {
            "verify": "default",   # 본인인증 단계 - 화면 입력이므로 STT 불필요
            "address": "address_sido",
            "type": "type",
            "sign": "default",    # 전자서명 단계 - 화면 터치 대기
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
        ),
        BlockingCondition(
            set_on_function="navigate_step",
            set_condition=lambda args: args.get("step") == "sign",
            blocks=lambda name, args: name != "issue_document",
            waiting_message=(
                "전자서명 단계입니다. 화면에서 전자서명이 완료될 때까지 기다리세요. "
                "전자서명 완료 시스템 메시지가 전달될 때까지 어떤 function call도 호출하지 마세요."
            ),
        )
    ],
    system_prompt_section={
        "ko": """─── 주민등록등본 발급 절차 (이 순서를 반드시 지키세요) ───

0단계 - 서류 확인 (필수):
  - 사용자가 주민등록등본을 요청하면 반드시 먼저 get_service_details(serviceId: 'resident-copy')를 호출하세요.

1단계 - 본인인증 (서류 선택 직후 가장 먼저):
  - navigate_step('verify')를 호출하여 화면을 본인인증 단계로 전환하세요.
  - 꼭 "본인인증을 위해 화면에 이름, 생년월일, 주민번호 뒷자리 한 자리, 통신사, 휴대폰 번호를 입력해 주세요. 인증번호를 받으시면 확인을 진행 해 주세요."라고 안내하세요.
  - 화면 폼에서 사용자가 정보 입력 → 인증번호 SMS → 인증번호 확인까지 자동으로 처리됩니다.
  - 시스템 메시지로 identity_verified: true 가 오면 본인인증 완료입니다. 그 전에는 절대로 다음 단계로 넘어가지 마세요.
  - 본인인증 대기 중에는 "도움이 필요하시면 아래 마이크버튼을 눌러 말씀해 주세요."라고 1회만 안내하세요.

2단계 - 주소 입력 (본인인증 완료 후):
  - 사용자에게 주민등록상 주소(시/도)를 물어보세요.
  - 【지리 검증 필수】 set_address를 호출하기 전에 시/군/구가 해당 시/도에 실제로 속하는지 반드시 확인하세요.
  - set_address(sido, sigungu) 호출 후 "[시도] [시군구]로 설정되었습니다."라고 짧게 안내만 하고 바로 다음 단계로 넘어가세요. 추가 확인 질문("맞으시나요?" 등)은 하지 마세요.

3단계 - 발급형태 선택:
  - 기본발급과 선택발급 중 어떤 형태로 발급하시겠어요? 안내하세요.
  - 【확인 질문 필수】 set_issuance_type 호출 후 반드시 확인하세요.

4단계 - 선택발급 옵션 (선택발급인 경우에만):
  - set_issuance_type(type: 'custom') 호출 후, 화면에서 터치하여 선택하도록 안내하세요.
  - 선택완료 전까지 어떤 function call도 호출하지 마세요.

5단계 - 전자서명 (기본발급/선택발급 모두 필수):
  - navigate_step('sign')을 호출하여 전자서명 화면으로 이동하세요.
  - 사용자에게 "화면에서 전자서명 방법을 선택하고 전자증명서를 신청해 주세요."라고 안내하세요.
  - 전자서명 완료 시스템 메시지가 올 때까지 기다리세요. 
  - 대기 중에는 "도움이 필요하시면 아래 마이크버튼을 눌러 말씀해 주세요."라고 1회만 안내하세요.
  - 완료 전까지 어떤 function call도 호출하지 마세요.
  - 전자서명 완료후 "출력을 시작합니다."라고 안내하세요.

Step 0: Call get_service_details(serviceId: 'resident-copy') first.
Step 1: Identity verification FIRST — navigate_step('verify'), instruct user to fill form on screen. Wait for identity_verified signal.
Step 2: Address — ask for sido, then sigungu. Validate geography. Confirm after set_address.
Step 3: Issuance type — basic or custom. Confirm after set_issuance_type.
Step 4: Custom options (only if custom) — wait for screen confirmation.
Step 5: Issue — call issue_document.""",
    },
)