"""In-memory WebRTC signaling bus for live verification sessions.

Single-process deployments store offer/answer/ICE messages here. For
multi-instance production, replace with Redis pub/sub without changing API.
"""
from __future__ import annotations

import itertools
import threading
from dataclasses import dataclass, field
from datetime import datetime

_lock = threading.Lock()
_counter = itertools.count(1)
_rooms: dict[int, list[dict]] = {}


@dataclass
class SignalMessage:
    id: int
    session_id: int
    from_user_id: int
    from_role: str
    type: str
    payload: dict
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "from_user_id": self.from_user_id,
            "from_role": self.from_role,
            "type": self.type,
            "payload": self.payload,
            "created_at": self.created_at,
        }


def publish(session_id: int, from_user_id: int, from_role: str,
            msg_type: str, payload: dict) -> dict:
    message = SignalMessage(
        id=next(_counter),
        session_id=session_id,
        from_user_id=from_user_id,
        from_role=from_role,
        type=msg_type,
        payload=payload or {},
    )
    with _lock:
        _rooms.setdefault(session_id, []).append(message.to_dict())
    return message.to_dict()


def fetch_since(session_id: int, after_id: int = 0) -> list[dict]:
    with _lock:
        messages = list(_rooms.get(session_id, []))
    return [msg for msg in messages if msg["id"] > after_id]


def clear_room(session_id: int) -> None:
    with _lock:
        _rooms.pop(session_id, None)
