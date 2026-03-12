"""
TtlMap — a dict with per-entry TTL expiry.
Mirrors server/src/utils/ttlMap.ts
"""
import time
from typing import TypeVar, Generic, Optional, Iterator, Tuple

K = TypeVar("K")
V = TypeVar("V")


class TtlMap(Generic[K, V]):
    def __init__(self, ttl_ms: int):
        self._ttl_ms = ttl_ms
        self._store: dict[K, tuple[V, float]] = {}  # key → (value, expires_at_sec)

    def _now(self) -> float:
        return time.time() * 1000  # ms

    def get(self, key: K) -> Optional[V]:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if self._now() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: K, value: V) -> None:
        self._evict_expired()
        self._store[key] = (value, self._now() + self._ttl_ms)

    def has(self, key: K) -> bool:
        return self.get(key) is not None

    def delete(self, key: K) -> bool:
        return self._store.pop(key, None) is not None

    def clear(self) -> None:
        self._store.clear()

    def entries(self) -> Iterator[Tuple[K, V]]:
        now = self._now()
        return ((k, v) for k, (v, exp) in list(self._store.items()) if now <= exp)

    def _evict_expired(self) -> None:
        now = self._now()
        expired = [k for k, (_, exp) in self._store.items() if now > exp]
        for k in expired:
            del self._store[k]
