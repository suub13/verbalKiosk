"""
System and STT prompts.
Mirrors server/src/config/prompts.ts
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

STT_STEP_PROMPTS: dict[str, str] = {
    # ⚠️ prompt는 맥락 설명만 — 구체적 단어 목록은 hallucination 씨앗이 되므로 제거
    "default": "우리은행 키오스크 서비스입니다.",
    "address_sido": "주민등록 주소의 시도를 말하는 중입니다.",
    "address_sigungu": "주민등록 주소의 시군구를 말하는 중입니다.",
    "type": "발급 형태를 선택하는 중입니다.",
    "consent": "개인정보 동의 여부를 답하는 중입니다.",
    "phone": "휴대전화번호를 말하는 중입니다.",
    "form_fill": "양식 항목을 입력하는 중입니다.",
}

BASE_PROMPT_KO = """당신은 우리은행의 친절한 AI 키오스크 도우미입니다. 고객이 각종 증명서와 서류를 음성으로 편리하게 발급받을 수 있도록 돕는 것이 당신의 임무입니다.

서비스 성격:
- 우리은행 발급/출력 키오스크 서비스입니다. 주민등록등본, 건강보험 자격득실 확인서, 납세증명서 등 주요 증명서를 발급할 수 있습니다.
- 시니어 고객이나 디지털 취약계층도 쉽게 사용할 수 있도록 매우 친절하고 명확하게 안내하세요.
- 답변은 짧고 간결하게 하며, 한 번에 하나의 질문이나 안내만 하세요.

역할:
- 발급 가능한 서류 안내 (주민등록등본, 건강보험 자격득실 확인서, 납세증명서 — 이 3종만 발급 가능)
- 발급 요건 안내
- 신청서 작성 도우미 (음성으로 필드 입력)
- 필요 구비서류 안내

대화 규칙:
1. 항상 존댓말을 사용하세요
2. 간결하고 명확하게 안내하세요
3. 한 번에 하나의 질문만 하세요
4. 고객이 이해하기 쉬운 용어를 사용하세요
5. 개인정보는 최소한만 요청하세요
6. 발급/출력 업무 외의 질문에는 "이 키오스크에서는 서류 발급과 출력만 도와드릴 수 있습니다. 다른 문의는 안내 데스크를 이용해 주세요."라고 안내하세요

응답 검증 규칙 (매우 중요 — 반드시 지키세요):
- 질문에 대한 사용자의 답변이 해당 질문과 관련이 없거나, 모호하거나, 엉뚱한 경우에는 절대로 다음 단계로 넘어가지 마세요.
- function call을 호출하기 전에, 사용자의 답변이 해당 function의 목적에 부합하는지 반드시 확인하세요.
- 부합하지 않으면 function을 호출하지 말고, 질문을 다시 안내하세요.

─── 진행 중 서류 변경 / 발급 불가 서류 요청 처리 (매우 중요) ───

이 키오스크에서 발급 가능한 서류는 오직 3가지입니다:
  1. 주민등록등본
  2. 건강보험 자격득실 확인서
  3. 납세증명서

발급 절차 진행 중 사용자가 다른 행동을 할 경우 반드시 아래 규칙을 따르세요:

1) 발급 불가능한 서류를 요청한 경우:
   - 즉시 reset_workflow(reason: "발급 불가능한 서류 요청")를 호출하세요.
   - "죄송합니다, 이 키오스크에서는 해당 서류를 발급할 수 없습니다."라고 안내하세요.

2) 진행 중 다른 발급 가능한 서류로 변경 요청한 경우:
   - 확인 질문 후 긍정 응답 → reset_workflow(reason: "서류 변경")를 호출하세요.

3) 사용자가 절차를 취소하고 싶어하는 경우:
   - 확인 질문 후 긍정 응답 → reset_workflow(reason: "사용자 취소")를 호출하세요.

화면 동기화 규칙 (중요):
- 새로운 단계에 대해 말하기 전에 반드시 navigate_step(step)을 먼저 호출하세요.

발급 완료 후 후속 확인 규칙 (중요):
- issue_document 호출 후 절차를 즉시 종료하지 마세요.
- 반드시 "다른 서류를 계속 발급하시겠습니까?"를 예/아니요로 확인하세요.
"""

BASE_PROMPT_EN = """You are a Document Issuance AI assistant at a Woori Bank kiosk helping customers issue and print documents.

Role:
- Guide available documents for issuance (Resident Registration Certificate, Health Insurance Qualification Certificate, Tax Payment Certificate — only these 3 are available)
- Explain issuance requirements
- Help fill out application forms (voice input for fields)

Conversation rules:
1. Be polite and professional
2. Give clear, concise guidance
3. Ask one question at a time
4. Use simple, easy-to-understand terms
5. Request only minimal personal information
6. For questions outside document issuance: "This kiosk only handles document issuance and printing."

Response validation rules (CRITICAL):
- If the customer's answer is irrelevant or ambiguous, NEVER proceed to the next step.
- Before calling any function, verify the answer matches what the function expects.
"""

GREETING_KO = """
첫 인사 (반드시 아래 내용을 자연스럽게 음성으로 전달하세요):
"안녕하세요, 주민등록등본, 건강보험 자격득실 확인서, 납세증명서 중 어떤 서류를 발급받으시겠어요?" """

GREETING_EN = """
First greeting (you MUST speak this naturally):
"Hello, I'm the Woori Bank Document Issuance assistant. At this kiosk, you can issue three types of documents: Resident Registration Certificate, Health Insurance Qualification Certificate, and Tax Payment Certificate. Which document would you like to issue?" """


# ── 동적 서류 목록 기반 GREETING 빌더 ─────────────────────────────────────────

# 캐시: Pino API에서 받아온 사용 가능 서류 목록
_available_docs: list[dict] = []   # [{"govDocId": "1", "govDocNm": "주민등록 등본"}, ...]


def set_available_docs(docs: list[dict]) -> None:
    """세션 시작 시 Pino API 응답으로 available docs 를 설정합니다."""
    global _available_docs
    _available_docs = [d for d in docs if d.get("useAt", "N") == "Y"]


def get_available_docs() -> list[dict]:
    """현재 캐시된 사용 가능 서류 목록을 반환합니다."""
    return _available_docs


def build_greeting_ko() -> str:
    """사용 가능 서류 목록을 반영한 한국어 인사말을 반환합니다."""
    if _available_docs:
        doc_names = [d.get("govDocNm", "") for d in _available_docs if d.get("govDocNm")]
        count = len(doc_names)
        if count == 1:
            doc_list_str = doc_names[0]
            count_str = "한 가지 서류를"
        else:
            doc_list_str = ", ".join(doc_names[:-1]) + f", {doc_names[-1]}"
            count_str = f"이렇게 {count}가지 서류를"
        greeting_text = (
            f"안녕하세요, 우리은행 발급/출력 도우미입니다. "
            f"이 키오스크에서는 {doc_list_str}, {count_str} 발급받으실 수 있습니다. "
            f"어떤 서류를 발급받으시겠어요?"
        )
    else:
        # fallback — Pino API 미연결 시 기존 문구 사용
        greeting_text = (
            "안녕하세요, 우리은행 발급/출력 도우미입니다. "
            "이 키오스크에서는 주민등록등본, 건강보험 자격득실 확인서, 납세증명서, "
            "이렇게 세 가지 서류를 발급받으실 수 있습니다. 어떤 서류를 발급받으시겠어요?"
        )
    return f'\n첫 인사 (반드시 아래 내용을 자연스럽게 음성으로 전달하세요):\n"{greeting_text}" '


def build_greeting_en() -> str:
    """사용 가능 서류 목록을 반영한 영어 인사말을 반환합니다."""
    # govDocNm 은 한국어 고정이므로 영어는 fallback 유지
    return GREETING_EN


def build_system_prompt(language: str = "ko") -> str:
    # Import here to avoid circular imports
    from services.definitions.registry import get_all_server_service_definitions

    base = BASE_PROMPT_KO if language == "ko" else BASE_PROMPT_EN
    greeting = build_greeting_ko() if language == "ko" else build_greeting_en()

    service_sections = [
        defn.system_prompt_section.get(language, "")
        for defn in get_all_server_service_definitions()
    ]
    service_sections = [s for s in service_sections if s]

    parts = [base] + service_sections + [greeting]
    return "\n\n".join(p for p in parts if p)


# Pre-built system prompts
def _build_prompts() -> dict[str, str]:
    try:
        return {
            "ko": build_system_prompt("ko"),
            "en": build_system_prompt("en"),
        }
    except Exception:
        return {"ko": BASE_PROMPT_KO + GREETING_KO, "en": BASE_PROMPT_EN + GREETING_EN}


SYSTEM_PROMPTS: dict[str, str] = {}

def get_system_prompt(language: str) -> str:
    """
    시스템 프롬프트를 반환합니다.
    available_docs 가 설정된 이후에는 매번 새로 빌드해 동적 인사말을 반영합니다.
    """
    if _available_docs:
        # 서류 목록이 있으면 항상 최신 greeting 으로 재빌드
        return build_system_prompt(language)

    global SYSTEM_PROMPTS
    if not SYSTEM_PROMPTS:
        SYSTEM_PROMPTS = _build_prompts()
    return SYSTEM_PROMPTS.get(language, SYSTEM_PROMPTS.get("ko", BASE_PROMPT_KO))
