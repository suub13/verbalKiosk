"""
Chat route (Service 2 - Cascaded pipeline).
POST /api/chat - LLM conversation with function calling
Mirrors server/src/routes/chat.ts
"""
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.openai_client import get_openai
from services.civil_service_registry import CivilServiceRegistry
from middleware.session_validator import validate_session
from shared import CIVIL_SERVICE_TOOLS
from utils.ttl_map import TtlMap

router = APIRouter()
civil_service_registry = CivilServiceRegistry()

# Per-session conversation history — 30 min TTL
conversation_history: TtlMap[str, list] = TtlMap(30 * 60 * 1000)

# Per-session Pino state (userToken, accessToken, refreshToken, signToken, providerId, userPhone, govDocId)
pino_state: TtlMap[str, dict] = TtlMap(30 * 60 * 1000)

OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {"name": t["name"], "description": t["description"], "parameters": t["parameters"]},
    }
    for t in CIVIL_SERVICE_TOOLS
]


class ChatRequest(BaseModel):
    sessionId: str
    message: str
    context: dict | None = None


async def _execute_pino_function(session_id: str, function_name: str, args: dict) -> dict:
    """Pino API tool call 을 처리합니다."""
    import asyncio
    from services import pino_api

    state = pino_state.get(session_id) or {}

    if function_name == "pino_request_sms":
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: pino_api.identity_verify(
                providerId=args["providerId"],
                userName=args["userName"],
                userBirthday=args["userBirthday"],
                userPhone=args["userPhone"],
                userRegistSingleNumber=args["userRegistSingleNumber"],
            ),
        )
        state["userToken"] = result.get("userToken")
        state["providerId"] = args["providerId"]
        state["userPhone"] = args["userPhone"]
        pino_state.set(session_id, state)
        return {"success": True, "message": "SMS 인증번호가 발송되었습니다. 6자리 인증번호를 입력해 주세요."}

    elif function_name == "pino_verify_auth_number":
        user_token = state.get("userToken")
        if not user_token:
            return {"success": False, "error": "본인확인 요청을 먼저 진행해 주세요."}
        access_token, refresh_token = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: pino_api.get_token(user_token, args["authNumber"]),
        )
        state["accessToken"] = access_token
        state["refreshToken"] = refresh_token
        pino_state.set(session_id, state)
        return {"success": True, "message": "본인인증이 완료되었습니다."}

    elif function_name == "pino_apply_check":
        access_token = state.get("accessToken")
        if not access_token:
            return {"success": False, "error": "본인인증이 필요합니다."}
        gov_doc_id = args["govDocId"]
        state["govDocId"] = gov_doc_id
        pino_state.set(session_id, state)
        option_list = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: pino_api.apply_check(access_token, gov_doc_id),
        )
        return {"success": True, "applyOptionList": option_list}

    elif function_name == "pino_apply_sign":
        access_token = state.get("accessToken")
        if not access_token:
            return {"success": False, "error": "본인인증이 필요합니다."}
        gov_doc_id = args.get("govDocId") or state.get("govDocId")
        state["govDocId"] = gov_doc_id
        sign_token = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: pino_api.apply_sign(
                access_token=access_token,
                gov_doc_id=gov_doc_id,
                providerId=state.get("providerId", ""),
                userPhone=state.get("userPhone", ""),
                applyOptionList=args.get("applyOptionList", []),
            ),
        )
        state["signToken"] = sign_token
        pino_state.set(session_id, state)
        return {
            "success": True,
            "signToken": sign_token,
            "message": "전자 서명 요청이 완료되었습니다. 외부 앱(예: 네이버)에서 인증을 완료한 후 '인증완료' 버튼을 눌러주세요.",
        }

    elif function_name == "pino_doc_apply":
        access_token = state.get("accessToken")
        sign_token = state.get("signToken")
        gov_doc_id = args.get("govDocId") or state.get("govDocId")
        if not access_token or not sign_token:
            return {"success": False, "error": "서명 요청을 먼저 진행해 주세요."}
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: pino_api.doc_apply(access_token, gov_doc_id, sign_token),
        )
        # 발급 완료 후 signToken 초기화
        state.pop("signToken", None)
        pino_state.set(session_id, state)
        return {"success": True, "message": "전자증명서 발급이 완료되었습니다.", "result": result}

    return {"error": f"Unknown pino function: {function_name}"}


class ChatRequest(BaseModel):
    sessionId: str
    message: str
    context: dict | None = None


@router.post("")
async def chat(body: ChatRequest):
    await validate_session(body.sessionId)

    if not body.message:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "INVALID_REQUEST", "message": "message is required"},
        })

    # Get or create conversation history
    if not conversation_history.has(body.sessionId):
        document_id = (body.context or {}).get("documentId", "")
        system_msg = (
            "당신은 발급/출력 AI 도우미입니다. 시민이 업로드한 서류의 내용을 이해하기 쉽게 설명하고, "
            "발급·출력 절차를 안내합니다.\n간결하고 명확하게 안내하세요. "
            "발급/출력 업무 외의 질문에는 안내 데스크 이용을 권유하세요.\n"
            f"{'현재 문서 ID: ' + document_id if document_id else ''}"
        )
        conversation_history.set(body.sessionId, [{"role": "system", "content": system_msg}])

    history = conversation_history.get(body.sessionId)
    history.append({"role": "user", "content": body.message})

    try:
        response = await get_openai().chat.completions.create(
            model="gpt-4o",
            messages=history,
            tools=OPENAI_TOOLS,  # type: ignore
        )

        assistant_message = response.choices[0].message
        if not assistant_message:
            raise ValueError("No response from LLM")

        function_calls = []

        if assistant_message.tool_calls:
            history.append(assistant_message.model_dump(exclude_none=True))

            for tool_call in assistant_message.tool_calls:
                args = json.loads(tool_call.function.arguments)
                fn_name = tool_call.function.name

                # Pino API tool calls are handled separately
                if fn_name.startswith("pino_"):
                    result = await _execute_pino_function(body.sessionId, fn_name, args)
                else:
                    result = await civil_service_registry.execute_function(fn_name, args)

                function_calls.append({"name": fn_name, "result": result})
                history.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })

            follow_up = await get_openai().chat.completions.create(
                model="gpt-4o",
                messages=history,
            )
            final_message = follow_up.choices[0].message
            if final_message:
                history.append(final_message.model_dump(exclude_none=True))
                return {
                    "success": True,
                    "data": {
                        "reply": final_message.content or "",
                        "functionCalls": function_calls,
                    },
                }
        else:
            history.append(assistant_message.model_dump(exclude_none=True))

        # Trim history
        if len(history) > 30:
            system = history[0]
            conversation_history.set(body.sessionId, [system] + history[-20:])
        else:
            conversation_history.set(body.sessionId, history)

        return {
            "success": True,
            "data": {
                "reply": assistant_message.content or "",
                "functionCalls": function_calls if function_calls else None,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "CHAT_FAILED", "message": str(e)},
        })
