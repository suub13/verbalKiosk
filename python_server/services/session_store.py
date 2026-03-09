"""
Session store — in-memory with TTL cleanup.
Mirrors server/src/services/sessionStore.ts
"""
import asyncio
import os
import uuid
import time
from dataclasses import dataclass, field
from typing import Optional, Literal

SESSION_TIMEOUT_MS = int(os.environ.get("SESSION_TIMEOUT_MS", "600000"))  # 10 min


@dataclass
class Session:
    id: str
    language: str
    service_type: Literal["conversation", "document"]
    created_at: int
    expires_at: int
    last_activity_at: int
    data: dict = field(default_factory=dict)


class SessionStore:
    def __init__(self):
        self._sessions: dict[str, Session] = {}
        self._cleanup_task: asyncio.Task | None = None

    def _start_cleanup(self):
        if self._cleanup_task is None or self._cleanup_task.done():
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    self._cleanup_task = loop.create_task(self._cleanup_loop())
            except RuntimeError:
                pass

    async def _cleanup_loop(self):
        while True:
            await asyncio.sleep(60)
            self._cleanup()

    def _cleanup(self):
        now = int(time.time() * 1000)
        expired = [sid for sid, s in self._sessions.items() if now > s.expires_at]
        for sid in expired:
            del self._sessions[sid]

    async def create(self, language: str, service_type: str) -> Session:
        self._start_cleanup()
        now = int(time.time() * 1000)
        session = Session(
            id=str(uuid.uuid4()),
            language=language,
            service_type=service_type,  # type: ignore
            created_at=now,
            expires_at=now + SESSION_TIMEOUT_MS,
            last_activity_at=now,
        )
        self._sessions[session.id] = session
        return session

    async def get(self, session_id: str) -> Optional[Session]:
        return self._sessions.get(session_id)

    async def touch(self, session_id: str) -> None:
        session = self._sessions.get(session_id)
        if session:
            now = int(time.time() * 1000)
            session.last_activity_at = now
            session.expires_at = now + SESSION_TIMEOUT_MS

    async def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    async def set_data(self, session_id: str, key: str, value) -> None:
        session = self._sessions.get(session_id)
        if session:
            session.data[key] = value


session_store = SessionStore()
