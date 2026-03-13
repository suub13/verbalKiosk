"""
Realtime API WebSocket Proxy.
Full Python port of server/src/websocket/realtimeProxy.ts
"""
import asyncio
import json
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional, Any

import websockets
from fastapi import WebSocket, WebSocketDisconnect

from services.civil_service_registry import CivilServiceRegistry
from services.session_store import session_store
from services.definitions.registry import get_all_server_service_definitions
from config.prompts import STT_STEP_PROMPTS, get_system_prompt
from constants.timings import SESSION_TIMINGS
from shared import CIVIL_SERVICE_TOOLS

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"

civil_service_registry = CivilServiceRegistry()

# Active sessions keyed by WebSocket client
_sessions: dict[int, "ProxySession"] = {}  # id(ws) → session


def normalize_for_comparison(s: str) -> str:
    return re.sub(r"[\s,.\-/·~!?、，。：；\"\"\"''（）()]", "", s)


@dataclass
class ActiveBlockingCondition:
    condition_id: str
    blocks: Any  # list[str] | callable
    waiting_message: str


@dataclass
class ProxySession:
    client_ws: WebSocket
    session_id: str
    openai_ws: Any = None             # websockets.ClientConnection | None
    config: Optional[dict] = None
    created_at: float = field(default_factory=time.time)
    last_activity_at: float = field(default_factory=time.time)
    message_count: int = 0
    greeting_sent: bool = False
    current_stt_prompt: str = STT_STEP_PROMPTS["default"]
    speech_start_stt_prompt: str = STT_STEP_PROMPTS["default"]
    last_speech_started_at: float = 0
    active_blocking_condition: Optional[ActiveBlockingCondition] = None
    last_correction_rejected_at: float = 0
    activity_task: Optional[asyncio.Task] = None
    mic_blocked: bool = False   # True during verify step — drop incoming audio
    is_responding: bool = False  # True while OpenAI response is in progress
    current_step: str = ""  # 현재 workflow step (navigate_step FC로 설정)
    # Pino 세션 데이터 — set_address 매핑 및 issue_document에 사용
    pino_access_token: str = ""
    pino_carrier: str = ""
    pino_phone: str = ""
    pino_gov_doc_id: str = ""
    pino_apply_option_list: list = None  # apply_check 결과 전체
    pino_selected_options: list = None   # 최종 선택된 옵션 codes

    def __post_init__(self):
        if self.pino_apply_option_list is None:
            self.pino_apply_option_list = []
        if self.pino_selected_options is None:
            self.pino_selected_options = []


# ─── REST fallbacks ──────────────────────────────────────────────────────────

def handle_options_confirmed_rest(result: str) -> bool:
    for session in list(_sessions.values()):
        if session.active_blocking_condition:
            asyncio.create_task(_handle_options_confirmed(session, result))
            return True
    return False


def handle_correction_rejected_rest(step: Optional[str], session_id: Optional[str]) -> bool:
    for session in list(_sessions.values()):
        is_target = session_id is None or session.session_id == session_id
        if is_target and session.openai_ws is not None:
            asyncio.create_task(_handle_correction_rejection(session, step))
            return True
    return False


# ─── Main WebSocket handler (call from FastAPI) ───────────────────────────────

async def handle_realtime_ws(client_ws: WebSocket):
    await client_ws.accept()
    session_id = str(uuid.uuid4())
    session = ProxySession(client_ws=client_ws, session_id=session_id)
    _sessions[id(client_ws)] = session

    session.activity_task = asyncio.create_task(_activity_monitor(session))
    await _send_to_client(client_ws, {"type": "session.created", "sessionId": session_id})

    try:
        while True:
            data = await client_ws.receive_text()
            await _handle_client_message(session, data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[RealtimeProxy] Client error ({session_id}): {e}")
    finally:
        await _cleanup_session(session)
        _sessions.pop(id(client_ws), None)


# ─── Client message handler ───────────────────────────────────────────────────

async def _handle_client_message(session: ProxySession, data: str):
    _update_activity(session)

    try:
        event = json.loads(data)
    except json.JSONDecodeError:
        await _send_to_client(session.client_ws, {
            "type": "error", "error": "Invalid JSON", "code": "INVALID_MESSAGE"
        })
        return

    session.message_count += 1
    t = event.get("type")

    if t == "session.start":
        print(f"[RealtimeProxy] session.start received ({session.session_id})")
        if event.get("config", {}).get("sessionId"):
            session.session_id = event["config"]["sessionId"]
        await _connect_to_openai(session, event["config"])

    elif t in ("audio.append", "audio.commit", "conversation.clear"):
        # 본인인증 단계 중 마이크 차단 — 오디오 버퍼를 OpenAI로 전달하지 않음
        if session.mic_blocked and t in ("audio.append", "audio.commit"):
            print(f"[RealtimeProxy] Audio BLOCKED (mic_blocked) ({session.session_id})")
            return
        if t == "audio.append":
            print(f"[RealtimeProxy] Audio received → forwarding ({session.session_id})")
        await _forward_to_openai(session, event)

    elif t == "function_call.result":
        await _handle_function_result(session, event.get("callId"), event.get("result"))

    elif t == "correction.rejected":
        await _handle_correction_rejection(session, event.get("step"))

    elif t == "mic.unblock":
        # 사용자가 마이크 버튼을 눌러 수동으로 차단 해제
        session.mic_blocked = False
        print(f"[RealtimeProxy] Mic UNBLOCKED (manual) ({session.session_id})")
        if session.openai_ws:
            if session.is_responding:
                try:
                    # 응답 생성 중일 때만 취소 — 아닐 때 보내면 에러 발생
                    await session.openai_ws.send(json.dumps({"type": "response.cancel"}))
                except Exception:
                    pass

    elif t == "options.confirmed":
        await _handle_options_confirmed(session, event.get("result", ""))


# ─── Connect to OpenAI ────────────────────────────────────────────────────────

async def _connect_to_openai(session: ProxySession, config: dict):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        await _send_to_client(session.client_ws, {
            "type": "session.error", "error": "API key not configured", "code": "CONFIG_ERROR"
        })
        return

    session.config = config
    session.active_blocking_condition = None  # Reset on reconnect
    language = config.get("language", "ko")
    system_prompt = config.get("systemPrompt") or get_system_prompt(language)

    try:
        openai_ws = await websockets.connect(
            OPENAI_REALTIME_URL,
            extra_headers={
                "Authorization": f"Bearer {api_key}",
                "OpenAI-Beta": "realtime=v1",
            },
        )
        session.openai_ws = openai_ws
        print(f"[RealtimeProxy] Connected to OpenAI ({session.session_id})")

        # Build tools list: CIVIL_SERVICE_TOOLS + any extra from config
        tools = list(CIVIL_SERVICE_TOOLS)
        for extra in config.get("tools", []):
            tools.append(extra)

        turn_detection = config.get("turnDetection") or {
            "type": "server_vad",
            "threshold": 0.7,
            "prefix_padding_ms": 500,
            "silence_duration_ms": 500,
        }

        session_config = {
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": system_prompt,
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "gpt-4o-transcribe",
                    "language": "en" if language == "en" else "ko",
                    "prompt": STT_STEP_PROMPTS["default"],
                },
                "turn_detection": turn_detection,
                "tools": tools,
            },
        }
        await openai_ws.send(json.dumps(session_config))

        # Start listening to OpenAI in background
        asyncio.create_task(_listen_openai(session, openai_ws))

    except Exception as e:
        await _send_to_client(session.client_ws, {
            "type": "session.error",
            "error": f"Failed to connect to OpenAI: {e}",
            "code": "CONNECTION_FAILED",
        })


# ─── OpenAI message listener ─────────────────────────────────────────────────

async def _listen_openai(session: ProxySession, openai_ws):
    try:
        async for raw in openai_ws:
            await _handle_openai_message(session, raw)
    except Exception as e:
        print(f"[RealtimeProxy] OpenAI connection closed ({session.session_id}): {e}")
        await _send_to_client(session.client_ws, {
            "type": "error", "error": "OpenAI connection closed", "code": "OPENAI_DISCONNECTED"
        })
    finally:
        session.openai_ws = None


async def _handle_openai_message(session: ProxySession, raw: str):
    try:
        event = json.loads(raw)
    except Exception:
        return

    event_type = event.get("type", "")
    if event_type not in ("response.audio.delta", "response.audio_transcript.delta"):
        print(f"[RealtimeProxy] OpenAI event: {event_type} ({session.session_id})")

    match event_type:
        case "session.created":
            pass

        case "session.updated":
            print(f"[RealtimeProxy] OpenAI session updated ({session.session_id})")
            if not session.greeting_sent and session.openai_ws:
                session.greeting_sent = True
                await asyncio.sleep(0.5)
                if session.openai_ws:
                    await session.openai_ws.send(json.dumps({
                        "type": "conversation.item.create",
                        "item": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": "(사용자가 키오스크에 방금 도착했습니다. 첫 인사를 해주세요.)"}],
                        },
                    }))
                    await session.openai_ws.send(json.dumps({"type": "response.create"}))

        case "input_audio_buffer.speech_started":
            print(f"[RealtimeProxy] Speech started ({session.session_id})")
            session.last_speech_started_at = time.time()
            session.speech_start_stt_prompt = session.current_stt_prompt
            await _send_to_client(session.client_ws, {"type": "input_audio_buffer.speech_started"})

        case "input_audio_buffer.speech_stopped":
            await _send_to_client(session.client_ws, {"type": "input_audio_buffer.speech_stopped"})

        case "input_audio_buffer.committed":
            await _send_to_client(session.client_ws, {"type": "input_audio_buffer.committed"})

        case "response.audio.delta":
            await _send_to_client(session.client_ws, {
                "type": "response.audio.delta", "delta": event.get("delta", "")
            })

        case "response.audio.done":
            await _send_to_client(session.client_ws, {"type": "response.audio.done"})

        case "response.audio_transcript.delta":
            await _send_to_client(session.client_ws, {
                "type": "response.audio_transcript.delta", "delta": event.get("delta", "")
            })

        case "response.audio_transcript.done":
            await _send_to_client(session.client_ws, {
                "type": "response.audio_transcript.done", "transcript": event.get("transcript", "")
            })

        case "conversation.item.input_audio_transcription.completed":
            transcript = (event.get("transcript") or "").strip()
            print(f'[RealtimeProxy] STT Completed: "{transcript}" ({session.session_id})')

            if not transcript:
                await _send_to_client(session.client_ws, {"type": "transcription.filtered"})
                return

            normalized_transcript = normalize_for_comparison(transcript)

            # ── 발화 시간이 너무 짧으면 노이즈로 간주 (1.2초 미만 + 5글자 이하)
            speech_duration = time.time() - session.last_speech_started_at
            is_too_short = speech_duration < 1.2 and len(transcript) <= 5

            # ── 명확한 hallucination 패턴만 필터 (STT prompt 내용과 무관)
            HALLUCINATION_PATTERNS = [
                re.compile(r"^구동\s*좋아요[.!]?$"),
                re.compile(r"^자막\s*(제공|한국어|번역)"),
                re.compile(r"^번역\s*(제공|한국어)"),
                re.compile(r"MBC|KBS|SBS|EBS|유튜브"),
                re.compile(r"^(안녕하세요|감사합니다)[.!]?$"),
            ]
            is_hallucination = any(p.search(transcript.strip()) for p in HALLUCINATION_PATTERNS)

            # ── 시스템 메시지가 그대로 인식된 경우
            is_system_echo = (
                "시스템지시" in normalized_transcript
                or "사용자가키오스크에방금도착했습니다" in normalized_transcript
                or "우리은행키오스크서비스" in normalized_transcript
            )

            if is_hallucination or is_system_echo or is_too_short:
                reasons = []
                if is_hallucination: reasons.append("pattern")
                if is_system_echo: reasons.append("system")
                if is_too_short: reasons.append(f"too_short({speech_duration:.1f}s)")
                print(f'[RealtimeProxy] Filtered hallucination ({",".join(reasons)}): "{transcript}" ({session.session_id})')
                # OpenAI가 이미 응답 생성을 시작했을 수 있으므로 즉시 취소
                if session.openai_ws:
                    try:
                        await session.openai_ws.send(json.dumps({"type": "response.cancel"}))
                    except Exception:
                        pass
                await _send_to_client(session.client_ws, {"type": "transcription.filtered"})
                return

            await _send_to_client(session.client_ws, {
                "type": "conversation.item.input_audio_transcription.completed",
                "transcript": transcript,
            })

        case "response.created":
            session.is_responding = True
            await _send_to_client(session.client_ws, {"type": "response.created"})

        case "response.function_call_arguments.done":
            await _handle_function_call_from_openai(session, event)

        case "response.done":
            session.is_responding = False
            _update_activity(session)
            await _send_to_client(session.client_ws, {"type": "response.done"})

        case "error":
            err = event.get("error") or {}
            err_code = err.get("code", "") if isinstance(err, dict) else ""
            err_msg = err.get("message", "") if isinstance(err, dict) else str(err)
            # response.cancel 실패 에러는 무시 (hallucination 필터링 후 취소 시도 시 발생)
            if "cancellation" in err_msg.lower() or "no active response" in err_msg.lower() or err_code == "response_cancel_failed":
                print(f"[RealtimeProxy] Suppressed cancel error (expected): {err} ({session.session_id})")
                return
            print(f"[RealtimeProxy] OpenAI error event ({session.session_id}): {err}")
            await _send_to_client(session.client_ws, {
                "type": "error",
                "error": err_msg or "Unknown error",
                "code": err_code or "OPENAI_ERROR",
            })


# ─── STT prompt update ────────────────────────────────────────────────────────

async def _update_stt_prompt(session: ProxySession, prompt_key: Optional[str] = None):
    if prompt_key:
        new_prompt = STT_STEP_PROMPTS.get(prompt_key, prompt_key)
        if new_prompt == session.current_stt_prompt:
            return
        session.current_stt_prompt = new_prompt

    if not session.openai_ws:
        return

    lang = "en" if (session.config or {}).get("language") == "en" else "ko"
    await session.openai_ws.send(json.dumps({
        "type": "session.update",
        "session": {
            "input_audio_transcription": {
                "model": "gpt-4o-transcribe",
                "language": lang,
                "prompt": session.current_stt_prompt,
            }
        },
    }))
    print(f"[RealtimeProxy] STT prompt updated → {prompt_key or '(current)'} ({session.session_id})")


# ─── STT context after function call ─────────────────────────────────────────

def _get_next_stt_context(name: str, args: str) -> Optional[str]:
    try:
        parsed = json.loads(args)
    except Exception:
        parsed = {}

    # Shared mappings
    shared = {
        "request_identity_verification": "default",  # 화면 폼 입력이므로 consent STT 불필요
        "submit_identity_verification": "default",
        "reset_workflow": "default",
        "issue_document": "default",
        "fill_form_field": "form_fill",
        "set_current_field": "form_fill",
        "open_service_form": "form_fill",
    }
    if name in shared:
        return shared[name]

    # Service-specific
    for defn in get_all_server_service_definitions():
        mapping = defn.stt_context_after_function.get(name)
        if mapping is not None:
            if callable(mapping):
                return mapping(parsed)
            return mapping

    return None


# ─── Correction re-ask helpers ────────────────────────────────────────────────

def _get_reask_message(step: str) -> str:
    shared = {
        "verify": "사용자가 본인확인 결과를 거부했습니다. 이전 질문을 즉시 다시 해주세요.",
        "fill": "사용자가 입력 내용을 거부했습니다. 해당 항목을 즉시 다시 물어보세요.",
        "service": '사용자가 서비스 선택 결과를 거부했습니다. "어떤 서류를 발급하시겠어요?"라고 즉시 다시 물어보세요.',
    }
    if step in shared:
        return shared[step]

    for defn in get_all_server_service_definitions():
        msg = defn.correction_reask_messages.get(step)
        if msg:
            return msg

    return "사용자가 방금 음성 인식 결과가 잘못되었다고 거부했습니다. 이전 질문을 즉시 다시 해주세요."


def _get_correction_stt_prompt(step: str) -> Optional[str]:
    shared = {"verify": "default", "service": "default", "fill": "form_fill"}
    if step in shared:
        return shared[step]

    for defn in get_all_server_service_definitions():
        prompt = defn.correction_stt_prompts.get(step)
        if prompt:
            return prompt

    return None


# ─── Server-executed functions ────────────────────────────────────────────────

SERVER_EXECUTED_FUNCTIONS = {
    "request_identity_verification",
    "search_services",
    "get_service_details",
    "check_requirements",
    "submit_form",
}


async def _handle_function_call_from_openai(session: ProxySession, event: dict):
    call_id = event.get("call_id", "")
    name = event.get("name", "")
    args = event.get("arguments", "{}")

    print(f"[RealtimeProxy] FC → {name}({args}) [{call_id}] ({session.session_id})")

    # ── Check if current call is blocked ─────────────────────────────────────
    # Check BEFORE updating, so setOnFunction is never blocked by its own condition.
    if session.active_blocking_condition:
        blocks = session.active_blocking_condition.blocks
        waiting_message = session.active_blocking_condition.waiting_message
        is_blocked = False
        try:
            parsed = json.loads(args)
            if callable(blocks):
                is_blocked = blocks(name, parsed)
            else:
                is_blocked = name in blocks
        except Exception:
            is_blocked = not callable(blocks) and name in blocks

        if is_blocked:
            print(f"[RealtimeProxy] BLOCKED {name} ({session.session_id})")
            if session.openai_ws:
                await session.openai_ws.send(json.dumps({
                    "type": "conversation.item.create",
                    "item": {
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": json.dumps({"error": waiting_message}, ensure_ascii=False),
                    },
                }))
                await session.openai_ws.send(json.dumps({"type": "response.create"}))
            return

    # ── Update blocking conditions ─────────────────────────────────────────────
    for defn in get_all_server_service_definitions():
        for condition in defn.blocking_conditions:
            if condition.set_on_function == name:
                try:
                    parsed = json.loads(args)
                    cond_id = f"{defn.id}-{condition.set_on_function}"
                    if condition.set_condition(parsed):
                        session.active_blocking_condition = ActiveBlockingCondition(
                            condition_id=cond_id,
                            blocks=condition.blocks,
                            waiting_message=condition.waiting_message,
                        )
                    elif session.active_blocking_condition and session.active_blocking_condition.condition_id == cond_id:
                        session.active_blocking_condition = None
                except Exception:
                    pass

    # issue_document 호출 시 서버 세션의 pino 데이터를 arguments에 머지
    if name == "issue_document" and session.pino_access_token:
        try:
            merged = json.loads(args) if args else {}
            merged.setdefault("accessToken", session.pino_access_token)
            merged.setdefault("carrier", session.pino_carrier)
            merged.setdefault("phone", session.pino_phone)
            merged.setdefault("govDocId", session.pino_gov_doc_id)
            # pino_selected_options(주소 코드)를 base applyOptionList에 머지
            base_options = list(session.pino_apply_option_list or [])
            if session.pino_selected_options:
                # 주소 그룹은 pino_selected_options로 교체, 나머지는 base 유지
                addr_group_code = session.pino_selected_options[0].get("groupCode", "")
                base_options = [o for o in base_options if o.get("groupCode") != addr_group_code]
                base_options = session.pino_selected_options + base_options
            merged.setdefault("applyOptionList", base_options)
            args = json.dumps(merged, ensure_ascii=False)
            print(f"[RealtimeProxy] issue_document enriched with pino data ({session.session_id})")
        except Exception as e:
            print(f"[RealtimeProxy] issue_document enrich error: {e}")

    # Notify client about the function call
    await _send_to_client(session.client_ws, {
        "type": "response.function_call",
        "callId": call_id,
        "name": name,
        "arguments": args,
    })

    # Client-handled functions
    if name not in SERVER_EXECUTED_FUNCTIONS:
        # ── navigate_step('verify') → 마이크 차단 ──────────────────────────────
        # ── navigate_step(other)   → 마이크 복원 ──────────────────────────────
        if name == "navigate_step":
            try:
                step = json.loads(args).get("step", "")
                session.current_step = step
                MIC_BLOCKED_STEPS = {"verify", "sign"}
                if step in MIC_BLOCKED_STEPS:
                    session.mic_blocked = True
                    print(f"[RealtimeProxy] Mic BLOCKED ({step} step) ({session.session_id})")
                elif session.mic_blocked:
                    session.mic_blocked = False
                    print(f"[RealtimeProxy] Mic UNBLOCKED (step={step}) ({session.session_id})")
            except Exception:
                pass

        # Don't update STT context if blocking is now active (e.g. set_issuance_type(custom))
        # The AI should wait; STT context will be updated after blocking is cleared.
        # ── set_address: pino_apply_option_list 기반 코드 매핑 및 검증 ──────────
        if name == "set_address":
            try:
                a = json.loads(args)
                sido_raw = (a.get("sido") or "").strip()
                sigungu_raw = (a.get("sigungu") or "").strip()

                if sido_raw and sigungu_raw and session.pino_apply_option_list:
                    addr_group = next(
                        (g for g in session.pino_apply_option_list
                         if g.get("groupCodeName") == "주민등록상 주소 확인"),
                        None
                    )
                    if addr_group:
                        child_list = addr_group.get("childList", [])
                        matched = next(
                            (c for c in child_list
                             if sido_raw in c.get("name", "") and sigungu_raw in c.get("name", "")),
                            None
                        )
                        if matched:
                            session.pino_selected_options = [{
                                "groupCode": addr_group["groupCode"],
                                "codeList": [matched["code"]],
                            }]
                            print(f"[RealtimeProxy] set_address mapped: {matched['name']} → {matched['code']} ({session.session_id})")
                        else:
                            valid_names = [c["name"] for c in child_list if sido_raw in c.get("name", "")]
                            print(f"[RealtimeProxy] set_address no match: {sido_raw}/{sigungu_raw} ({session.session_id})")
                            if session.openai_ws:
                                if valid_names:
                                    err_msg = (
                                        f"오류: '{sido_raw} {sigungu_raw}'을(를) 주소 목록에서 찾을 수 없습니다. "
                                        f"'{sido_raw}'의 유효한 시/군/구: {', '.join(n.split()[-1] for n in valid_names[:10])}. "
                                        f"사용자에게 시/군/구를 다시 물어보세요."
                                    )
                                else:
                                    err_msg = (
                                        f"오류: '{sido_raw}'을(를) 주소 목록에서 찾을 수 없습니다. "
                                        f"사용자에게 시/도를 다시 말씀해달라고 하세요."
                                    )
                                await session.openai_ws.send(json.dumps({
                                    "type": "conversation.item.create",
                                    "item": {"type": "function_call_output", "call_id": call_id, "output": err_msg},
                                }))
                                await session.openai_ws.send(json.dumps({"type": "response.create"}))
                            return

                elif sido_raw and sigungu_raw:
                    # apply_option_list 없을 때 fallback
                    from config.sigungu_prompt import _SIGUNGU_BY_SIDO, _SIDO_ALIASES
                    sido_key = _SIDO_ALIASES.get(sido_raw, sido_raw)
                    valid_list = _SIGUNGU_BY_SIDO.get(sido_key, "")
                    if valid_list and sigungu_raw not in valid_list:
                        print(f"[RealtimeProxy] set_address geo mismatch (fallback): {sido_raw}/{sigungu_raw} ({session.session_id})")
                        if session.openai_ws:
                            await session.openai_ws.send(json.dumps({
                                "type": "conversation.item.create",
                                "item": {"type": "function_call_output", "call_id": call_id,
                                         "output": f"오류: '{sigungu_raw}'은(는) '{sido_raw}'에 속하지 않습니다. 올바른 시/군/구를 다시 물어보세요."},
                            }))
                            await session.openai_ws.send(json.dumps({"type": "response.create"}))
                        return

            except Exception as e:
                print(f"[RealtimeProxy] set_address validation error: {e}")

        # ── set_issuance_type: 서버에서 로깅 및 검증 ────────────────────────────
        if name == "set_issuance_type":
            try:
                t = json.loads(args).get("type", "")
                print(f"[RealtimeProxy] set_issuance_type called with type='{t}' ({session.session_id})")
                if t not in ("basic", "custom"):
                    if session.openai_ws:
                        await session.openai_ws.send(json.dumps({
                            "type": "conversation.item.create",
                            "item": {"type": "function_call_output", "call_id": call_id,
                                     "output": f"오류: type='{t}'은 유효하지 않습니다. 'basic' 또는 'custom'만 허용됩니다."},
                        }))
                        await session.openai_ws.send(json.dumps({"type": "response.create"}))
                    return
            except Exception as e:
                print(f"[RealtimeProxy] set_issuance_type validation error: {e}")

        if not session.active_blocking_condition:
            next_prompt = _get_next_stt_context(name, args)
            if next_prompt:
                await _update_stt_prompt(session, next_prompt)
        return

    # ── Identity verification (레거시 - 새 흐름에서는 화면 폼으로 대체됨) ──────────
    # navigate_step('verify')만으로 화면에 폼이 표시되므로 이 함수는 사용되지 않음
    # AI가 혹시 호출하더라도 안내만 반환하고 동의 요청은 하지 않음
    if name == "request_identity_verification":
        result = {
            "status": "form_displayed",
            "instruction": (
                "화면에 본인인증 폼이 이미 표시되어 있습니다. "
                "사용자에게 \"화면에 이름, 생년월일, 주민번호 뒷자리 1자리, 통신사, 휴대폰 번호를 입력해 주세요.\"라고 안내하세요. "
                "인증번호를 받아 입력까지 완료하면 시스템이 자동으로 알려줍니다. "
                "그 전까지 submit_identity_verification 등 다른 함수를 호출하지 마세요."
            ),
        }
        if session.openai_ws:
            await session.openai_ws.send(json.dumps({
                "type": "conversation.item.create",
                "item": {
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": json.dumps(result, ensure_ascii=False),
                },
            }))
            await session.openai_ws.send(json.dumps({"type": "response.create"}))
        await _update_stt_prompt(session, "default")
        return

    # ── Other server-side functions ───────────────────────────────────────────
    try:
        parsed_args = json.loads(args)
        result = await civil_service_registry.execute_function(name, parsed_args)

        if session.openai_ws:
            await session.openai_ws.send(json.dumps({
                "type": "conversation.item.create",
                "item": {
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": json.dumps(result, ensure_ascii=False),
                },
            }))
            await session.openai_ws.send(json.dumps({"type": "response.create"}))

            next_prompt = _get_next_stt_context(name, args)
            if next_prompt:
                await _update_stt_prompt(session, next_prompt)

    except Exception as e:
        print(f"[RealtimeProxy] Function call error: {e}")
        if session.openai_ws:
            await session.openai_ws.send(json.dumps({
                "type": "conversation.item.create",
                "item": {
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": json.dumps({"error": "Function execution failed"}, ensure_ascii=False),
                },
            }))
            await session.openai_ws.send(json.dumps({"type": "response.create"}))


# ─── Correction rejection ─────────────────────────────────────────────────────

async def _handle_correction_rejection(session: ProxySession, step: Optional[str]):
    if not session.openai_ws:
        return

    now = time.time()
    if (now - session.last_correction_rejected_at) * 1000 < SESSION_TIMINGS["CORRECTION_DEDUP_MS"]:
        return
    session.last_correction_rejected_at = now

    print(f"[RealtimeProxy] Correction rejected (step: {step or 'unknown'}) ({session.session_id})")

    if session.is_responding:
        try:
            await session.openai_ws.send(json.dumps({"type": "response.cancel"}))
        except Exception:
            pass

    text = _get_reask_message(step or "")
    await session.openai_ws.send(json.dumps({
        "type": "conversation.item.create",
        "item": {
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": f"(시스템 지시: 사용자가 인식 결과를 거부했습니다. 절대 다른 말 하지 말고 즉시 다음 내용을 수행하세요: {text})"}],
        },
    }))

    if step:
        prompt_key = _get_correction_stt_prompt(step)
        if prompt_key:
            await _update_stt_prompt(session, prompt_key)

    await session.openai_ws.send(json.dumps({
        "type": "response.create",
        "response": {
            "instructions": "사용자가 방금 한 말이 틀렸다고 거부했습니다. 정중하게 사과하고, 해당 단계의 질문을 다시 하세요.",
        },
    }))


# ─── Options confirmed ────────────────────────────────────────────────────────

async def _handle_options_confirmed(session: ProxySession, result: str):
    session.active_blocking_condition = None
    if not session.openai_ws:
        return

    try:
        parsed = json.loads(result)
    except Exception:
        parsed = {}

    # identity_verified (새 흐름): 본인인증 완료 → apply_check → 주소 입력으로 안내
    if parsed.get("identity_verified") or parsed.get("identity_completed"):
        access_token = parsed.get("accessToken", "")
        carrier = parsed.get("carrier", "")
        phone = parsed.get("phone", "")

        # govDocId 조회: available_docs에서 주민등록등본 ID 찾기
        from config.prompts import get_available_docs
        from services.pino_api import apply_check as pino_apply_check

        apply_option_list = []
        gov_doc_id = ""
        try:
            available_docs = get_available_docs()
            doc = next((d for d in available_docs if "주민등록" in d.get("govDocNm", "")), None)
            if doc:
                gov_doc_id = doc.get("govDocId", "")
            if gov_doc_id and access_token:
                apply_option_list = pino_apply_check(access_token, gov_doc_id)
                print(f"[RealtimeProxy] apply_check 완료: {len(apply_option_list)}개 옵션그룹 ({session.session_id})")
        except Exception as e:
            print(f"[RealtimeProxy] apply_check 실패 (무시): {e} ({session.session_id})")

        # 세션에 Pino 데이터 저장 (set_address 매핑 및 issue_document에 사용)
        session.pino_access_token = access_token
        session.pino_carrier = carrier
        session.pino_phone = phone
        session.pino_gov_doc_id = gov_doc_id
        session.pino_apply_option_list = apply_option_list

        # 클라이언트에 apply_check 결과 전달 (serviceData에 저장하도록)
        if session.client_ws:
            await _send_to_client(session.client_ws, {
                "type": "pino.apply_check_result",
                "accessToken": access_token,
                "carrier": carrier,
                "phone": phone,
                "govDocId": gov_doc_id,
                "applyOptionList": apply_option_list,
            })

        text = (
            "사용자가 본인인증을 성공적으로 완료하였습니다. (identity_verified=true) "
            "사용자에게 \"주민등록상 주소를 말씀해 주세요.\"라고 음성으로 안내한 후, "
            "navigate_step('address')를 호출하고 주소 입력을 진행하세요."
        )
        await session.openai_ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": f"(시스템: {text})"}]},
        }))
        await session.openai_ws.send(json.dumps({"type": "response.create"}))
        # ⚠️ 본인인증 완료 → 마이크 차단 즉시 해제 (address 단계부터 음성 수신)
        session.mic_blocked = False
        session.current_step = "address"
        print(f"[RealtimeProxy] Mic UNBLOCKED (identity verified) ({session.session_id})")
        await _update_stt_prompt(session, "address_sido")
        print(f"[RealtimeProxy] Identity verified ({session.session_id})")
        return

    if parsed.get("cancelled"):
        text = '사용자가 선택발급 옵션을 취소했습니다. "기본발급과 선택발급 중 다시 선택해 주세요."라고 안내하세요.'
    elif parsed.get("doc_issued"):
        # 전자서명 완료 → 출력 단계로
        text = (
            "사용자에게 \"전자서명이 완료되었습니다. 이제 서류를 출력하겠습니다.\"라고 안내한 후, "
            "issue_document를 호출하여 출력 단계로 이동하세요."
        )
    else:
        # 발급옵션 선택 완료 → 전자서명 단계로
        text = (
            f"사용자가 선택발급 옵션 화면에서 선택을 완료했습니다. 선택 결과: {result}. "
            "사용자에게 \"발급 옵션 선택이 완료되었습니다. 이제 전자서명을 진행합니다.\"라고 음성으로 안내한 후, "
            "navigate_step('sign')을 호출하여 전자서명 단계로 이동하세요. issue_document는 호출하지 마세요."
        )

    await session.openai_ws.send(json.dumps({
        "type": "conversation.item.create",
        "item": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": f"(시스템: {text})"}]},
    }))
    await session.openai_ws.send(json.dumps({"type": "response.create"}))

    # Update STT context after options resolved
    if parsed.get("cancelled"):
        await _update_stt_prompt(session, "type")   # back to type selection
    else:
        await _update_stt_prompt(session, "default")  # proceed to issue

    print(f"[RealtimeProxy] Options {'cancelled' if parsed.get('cancelled') else 'confirmed'} ({session.session_id})")


# ─── Function result from client ─────────────────────────────────────────────

async def _handle_function_result(session: ProxySession, call_id: str, result: str):
    if session.openai_ws:
        await session.openai_ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {"type": "function_call_output", "call_id": call_id, "output": result},
        }))
        await session.openai_ws.send(json.dumps({"type": "response.create"}))


# ─── Forward to OpenAI ────────────────────────────────────────────────────────

async def _forward_to_openai(session: ProxySession, event: dict):
    if not session.openai_ws:
        return

    t = event.get("type")
    if t == "audio.append":
        # Block audio input while a blocking condition is active (e.g. options screen)
        if session.active_blocking_condition:
            return
        msg = {"type": "input_audio_buffer.append", "audio": event.get("audio", "")}
    elif t == "audio.commit":
        if session.active_blocking_condition:
            return
        msg = {"type": "input_audio_buffer.commit"}
    elif t == "conversation.clear":
        msg = {"type": "conversation.item.truncate"}
    else:
        return

    await session.openai_ws.send(json.dumps(msg))


# ─── Activity monitor ─────────────────────────────────────────────────────────

async def _activity_monitor(session: ProxySession):
    while True:
        await asyncio.sleep(SESSION_TIMINGS["ACTIVITY_CHECK_INTERVAL_MS"] / 1000)
        # verify/sign 단계(사용자 입력 대기 중)에는 타이머를 리셋 — 마이크 ON/OFF 무관하게
        if session.current_step in ("verify", "sign"):
            _update_activity(session)
            continue
        inactive_ms = (time.time() - session.last_activity_at) * 1000

        if inactive_ms > SESSION_TIMINGS["DISCONNECT_THRESHOLD_MS"]:
            print(f"[RealtimeProxy] Session {session.session_id} timed out")
            try:
                await session.client_ws.close(1000)
            except Exception:
                pass
            break

        if inactive_ms > SESSION_TIMINGS["SILENCE_THRESHOLD_MS"] and session.openai_ws:
            print(f"[RealtimeProxy] Silence detected for session {session.session_id}")
            await session.openai_ws.send(json.dumps({
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": "(시스템: 사용자가 30초 동안 아무 말도 하지 않았습니다. \"도움이 필요하신가요?\" 또는 \"계속 진행하시겠습니까?\"라고 물어보세요.)"}],
                },
            }))
            await session.openai_ws.send(json.dumps({"type": "response.create"}))
            _update_activity(session)


def _update_activity(session: ProxySession):
    session.last_activity_at = time.time()


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _send_to_client(ws: WebSocket, event: dict):
    try:
        await ws.send_text(json.dumps(event, ensure_ascii=False))
    except Exception:
        pass


async def _cleanup_session(session: ProxySession):
    if session.activity_task:
        session.activity_task.cancel()
        session.activity_task = None

    if session.session_id:
        try:
            await session_store.delete(session.session_id)
        except Exception:
            pass

    if session.openai_ws:
        try:
            await session.openai_ws.close()
        except Exception:
            pass
        session.openai_ws = None

    print(f"[RealtimeProxy] Session {session.session_id} cleaned up (messages: {session.message_count})")