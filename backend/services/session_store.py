"""
Session Store — Multi-turn Conversation (FR-11)
================================================
Maintains in-memory conversation history per session.

Design notes:
- Keyed by UUID session_id returned to and echoed by the frontend.
- Each session is a list of ConversationTurn dicts, used to build
  multi-turn prompt context for Gemini.
- Capped at MAX_TURNS_PER_SESSION to avoid unbounded context growth.
- In-memory only (no persistence) — sessions reset on server restart.
  This is appropriate for a portfolio demo; production would use Redis.
- TTL (time-to-live) pruning runs lazily on each access to avoid
  building up stale sessions indefinitely on the free-tier server.

SDLC Section 14 / FR-11:
    Multi-turn conversation is Phase 3 scope.
    The prior architecture was completely single-turn:
        (question → retrieval → generation → TTS → response)
    Phase 3 extends it to:
        (session_id + question + history → retrieval → generation → TTS → response)
"""

import time
from collections import defaultdict
from typing import Optional
from uuid import UUID, uuid4

# Max turns to keep per session (old ones are dropped)
MAX_TURNS_PER_SESSION = 10

# Sessions older than this (in seconds) are pruned (24 hours)
SESSION_TTL_SECONDS = 24 * 60 * 60


class ConversationTurn:
    """One Q&A exchange within a session."""

    __slots__ = ("question", "answer", "timestamp")

    def __init__(self, question: str, answer: str):
        self.question = question
        self.answer = answer
        self.timestamp = time.time()

    def to_dict(self) -> dict:
        return {
            "question": self.question,
            "answer": self.answer,
            "timestamp": self.timestamp,
        }


class SessionStore:
    """
    Thread-safe (asyncio-safe, single-process) in-memory session store.
    FastAPI runs in a single async process, so a dict is safe.
    """

    def __init__(self):
        # session_id (str UUID) → list[ConversationTurn]
        self._sessions: dict[str, list[ConversationTurn]] = defaultdict(list)
        # session_id → last-access timestamp (for TTL pruning)
        self._last_access: dict[str, float] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_session(self) -> str:
        """Create a new session and return its UUID string."""
        sid = str(uuid4())
        self._sessions[sid]  # initialise empty list via defaultdict
        self._touch(sid)
        return sid

    def get_history(self, session_id: str) -> list[ConversationTurn]:
        """Return turn list for a session; empty list if unknown."""
        self._prune_stale_sessions()
        turns = self._sessions.get(session_id, [])
        if turns:
            self._touch(session_id)
        return turns

    def add_turn(self, session_id: str, question: str, answer: str) -> None:
        """
        Append a completed Q&A turn to the session.
        If session doesn't exist yet it is created implicitly.
        Oldest turns are evicted once MAX_TURNS_PER_SESSION is reached.
        """
        self._prune_stale_sessions()
        turns = self._sessions[session_id]
        turns.append(ConversationTurn(question=question, answer=answer))
        if len(turns) > MAX_TURNS_PER_SESSION:
            # Drop oldest turns
            self._sessions[session_id] = turns[-MAX_TURNS_PER_SESSION:]
        self._touch(session_id)

    def delete_session(self, session_id: str) -> bool:
        """Delete a session. Returns True if it existed."""
        existed = session_id in self._sessions
        self._sessions.pop(session_id, None)
        self._last_access.pop(session_id, None)
        return existed

    def session_exists(self, session_id: str) -> bool:
        return session_id in self._sessions

    def get_all_sessions(self) -> dict[str, list[dict]]:
        """Return all sessions as serialisable dicts (for admin/debug)."""
        return {
            sid: [t.to_dict() for t in turns]
            for sid, turns in self._sessions.items()
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _touch(self, session_id: str) -> None:
        self._last_access[session_id] = time.time()

    def _prune_stale_sessions(self) -> None:
        """Lazily remove sessions that haven't been accessed within TTL."""
        now = time.time()
        stale = [
            sid
            for sid, last in self._last_access.items()
            if (now - last) > SESSION_TTL_SECONDS
        ]
        for sid in stale:
            self._sessions.pop(sid, None)
            self._last_access.pop(sid, None)


# ---------------------------------------------------------------------------
# Singleton — shared across all requests in the same process
# ---------------------------------------------------------------------------

_session_store: Optional[SessionStore] = None


def get_session_store() -> SessionStore:
    global _session_store
    if _session_store is None:
        _session_store = SessionStore()
    return _session_store
