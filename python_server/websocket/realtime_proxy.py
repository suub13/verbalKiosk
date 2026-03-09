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
        await _forward_to_openai(session, event)

    elif t == "function_call.result":
        await _handle_function_result(session, event.get("callId"), event.get("result"))

    elif t == "correction.rejected":
        await _handle_correction_rejection(session, event.get("step"))

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

            HALLUCINATION_PATTERNS = [
                re.compile(r"^구동\s*좋아요[.!]?$"),
                re.compile(r"^자막\s*(제공|한국어|번역)"),
                re.compile(r"^번역\s*(제공|한국어)"),
                re.compile(r"MBC|KBS|SBS|EBS|유튜브"),
                re.compile(r"^(안녕하세요|감사합니다)[.!]?$"),
            ]
            is_hallucination = any(p.search(transcript.strip()) for p in HALLUCINATION_PATTERNS)

            active_prompt = session.speech_start_stt_prompt or session.current_stt_prompt
            normalized_prompt = normalize_for_comparison(active_prompt)
            is_prompt_echo = len(transcript) > 10 and normalized_transcript in normalized_prompt

            is_system_echo = (
                "시스템지시" in normalized_transcript
                or "사용자가키오스크에방금도착했습니다" in normalized_transcript
                or normalize_for_comparison(STT_STEP_PROMPTS["default"]) in normalized_transcript
            )

            if is_hallucination or is_prompt_echo or is_system_echo:
                kind = "pattern" if is_hallucination else ("echo" if is_prompt_echo else "system")
                print(f'[RealtimeProxy] Filtered hallucination ({kind}): "{transcript}" ({session.session_id})')
                await _send_to_client(session.client_ws, {"type": "transcription.filtered"})
                return

            await _send_to_client(session.client_ws, {
                "type": "conversation.item.input_audio_transcription.completed",
                "transcript": transcript,
            })

        case "response.created":
            await _send_to_client(session.client_ws, {"type": "response.created"})

        case "response.function_call_arguments.done":
            await _handle_function_call_from_openai(session, event)

        case "response.done":
            _update_activity(session)
            await _send_to_client(session.client_ws, {"type": "response.done"})

        case "error":
            err = event.get("error") or {}
            print(f"[RealtimeProxy] OpenAI error event ({session.session_id}): {err}")
            await _send_to_client(session.client_ws, {
                "type": "error",
                "error": err.get("message", "Unknown error") if isinstance(err, dict) else str(err),
                "code": err.get("code", "OPENAI_ERROR") if isinstance(err, dict) else "OPENAI_ERROR",
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
        "request_identity_verification": "consent",
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
    shared = {"verify": "consent", "service": "default", "fill": "form_fill"}
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

    # Notify client about the function call
    await _send_to_client(session.client_ws, {
        "type": "response.function_call",
        "callId": call_id,
        "name": name,
        "arguments": args,
    })

    # Client-handled functions
    if name not in SERVER_EXECUTED_FUNCTIONS:
        # Don't update STT context if blocking is now active (e.g. set_issuance_type(custom))
        # The AI should wait; STT context will be updated after blocking is cleared.
        if not session.active_blocking_condition:
            next_prompt = _get_next_stt_context(name, args)
            if next_prompt:
                await _update_stt_prompt(session, next_prompt)
        return

    # ── Identity verification ─────────────────────────────────────────────────
    if name == "request_identity_verification":
        language = (session.config or {}).get("language", "ko")
        try:
            parsed = json.loads(args)
        except Exception:
            parsed = {}
        reason = parsed.get("reason", "서류 발급")

        if language == "ko":
            result = {
                "consentScript": (
                    f"이제 본인확인 단계입니다. {reason}을 위해 본인확인이 필요합니다. "
                    "개인정보 수집에 대해 안내드리겠습니다. 수집하는 항목은 이름, 주민등록번호, 통신사, 휴대폰 번호이며, "
                    "수집 목적은 본인확인입니다. 보유기간은 이 세션이 종료되면 즉시 삭제됩니다."
                ),
                "instruction": (
                    "위 consentScript 내용을 반드시 음성으로 전부 읽어주세요. 절대 생략하지 마세요. "
                    "다 읽은 후 \"동의하시겠습니까?\"라고 물어보세요. 사용자가 동의하면 "
                    "submit_identity_verification(consent: true)를 즉시 호출하세요. "
                    "전화번호는 화면 키보드로 직접 입력하므로 음성으로 묻지 마세요. "
                    "동의하지 않으면 submit_identity_verification(consent: false)를 호출하고 "
                    "\"개인정보 수집에 동의하지 않으시면 서류 발급을 진행할 수 없습니다.\"라고 안내하세요."
                ),
            }
        else:
            result = {
                "consentScript": (
                    f"Now we need to verify your identity. Identity verification is required for {reason}. "
                    "We need to collect your phone number for verification purposes. "
                    "It will be deleted immediately when this session ends."
                ),
                "instruction": (
                    "Read the consentScript above aloud to the user in full. Do NOT skip any part. "
                    "Then ask \"Do you agree?\" If yes, call submit_identity_verification(consent: true, phoneNumber: \"number\"). "
                    "If they decline, say \"Without consent for personal information collection, we cannot proceed.\""
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
        await _update_stt_prompt(session, "consent")
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

    await session.openai_ws.send(json.dumps({"type": "response.cancel"}))

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

    if parsed.get("identity_completed"):
        text = (
            "사용자가 본인인증 폼을 완료하였습니다. "
            "사용자에게 \"본인인증이 완료되었습니다. 서류를 발급하겠습니다.\"라고 음성으로 안내한 후, "
            "issue_document를 호출하세요."
        )
        await session.openai_ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": f"(시스템: {text})"}]},
        }))
        await session.openai_ws.send(json.dumps({"type": "response.create"}))
        print(f"[RealtimeProxy] Identity form completed ({session.session_id})")
        return

    if parsed.get("cancelled"):
        text = '사용자가 선택발급 옵션을 취소했습니다. "기본발급과 선택발급 중 다시 선택해 주세요."라고 안내하세요.'
    else:
        text = (
            f"사용자가 선택발급 옵션 화면에서 선택을 완료했습니다. 선택 결과: {result}. "
            "사용자에게 \"발급 옵션 선택이 완료되었습니다. 이제 본인확인을 진행하겠습니다.\"라고 음성으로 안내한 후, "
            "request_identity_verification을 호출하여 개인정보 수집 동의 절차를 시작하세요."
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
        await _update_stt_prompt(session, "consent")  # proceed to consent

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
