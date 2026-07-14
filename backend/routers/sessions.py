"""
Sessions Router — Phase 3 multi-turn conversation (FR-11)
===========================================================

Endpoints:
    POST   /api/sessions              — Create a new session, get session_id
    GET    /api/sessions/{session_id} — Fetch turn history for a session
    DELETE /api/sessions/{session_id} — Clear a session (start fresh)

The frontend can pre-create a session on page load and reuse the session_id
across all voice/text queries within a conversation, OR simply pass session_id=None
and let the query routers auto-create one.  Both flows are supported.
"""

from fastapi import APIRouter, HTTPException

from models.schemas import (
    ConversationHistoryResponse,
    ConversationTurnSchema,
    SessionCreateResponse,
)
from services.session_store import get_session_store

router = APIRouter()


@router.post("/sessions", response_model=SessionCreateResponse)
async def create_session():
    """Create a new conversation session. Returns the session_id to pass with future queries."""
    store = get_session_store()
    session_id = store.create_session()
    return SessionCreateResponse(session_id=session_id)


@router.get("/sessions/{session_id}", response_model=ConversationHistoryResponse)
async def get_session_history(session_id: str):
    """
    Retrieve the full conversation history for a session.
    Used by the frontend to hydrate conversation log on page load/refresh.
    """
    store = get_session_store()
    if not store.session_exists(session_id):
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found or has expired.")
    turns = store.get_history(session_id)
    return ConversationHistoryResponse(
        session_id=session_id,
        turns=[
            ConversationTurnSchema(
                question=t.question,
                answer=t.answer,
                timestamp=t.timestamp,
            )
            for t in turns
        ],
    )


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session and its conversation history.
    Call this when the user explicitly wants to start fresh.
    """
    store = get_session_store()
    existed = store.delete_session(session_id)
    if not existed:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return {"deleted": True, "session_id": session_id}
