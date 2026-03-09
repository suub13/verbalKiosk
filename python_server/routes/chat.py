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
                result = await civil_service_registry.execute_function(tool_call.function.name, args)
                function_calls.append({"name": tool_call.function.name, "result": result})
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
