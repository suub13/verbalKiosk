"""
ServerServiceDefinition type.
Mirrors server/src/services/definitions/types.ts
"""
from typing import Any, Callable


class BlockingCondition:
    def __init__(
        self,
        set_on_function: str,
        set_condition: Callable[[dict], bool],
        blocks: list[str] | Callable[[str, dict], bool],
        waiting_message: str,
        block_audio: bool = True,  # False면 오디오는 OpenAI로 통과시킴
    ):
        self.set_on_function = set_on_function
        self.set_condition = set_condition
        self.blocks = blocks
        self.waiting_message = waiting_message
        self.block_audio = block_audio


class ServerServiceDefinition:
    def __init__(
        self,
        id: str,
        stt_context_after_function: dict[str, str | Callable[[dict], str | None] | None],
        correction_reask_messages: dict[str, str],
        correction_stt_prompts: dict[str, str],
        blocking_conditions: list[BlockingCondition] | None = None,
        system_prompt_section: dict[str, str] | None = None,
    ):
        self.id = id
        self.stt_context_after_function = stt_context_after_function
        self.correction_reask_messages = correction_reask_messages
        self.correction_stt_prompts = correction_stt_prompts
        self.blocking_conditions = blocking_conditions or []
        self.system_prompt_section = system_prompt_section or {}