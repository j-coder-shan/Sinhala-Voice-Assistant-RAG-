"""
Voice Query Router — POST /api/voice-query
===========================================
Full pipeline: audio blob → STT → RAG retrieval → Gemini generation → TTS → response

SDLC Section 7 API contract:
    Request:  multipart audio file + optional Form field session_id
    Response: {transcript, answer_text, answer_audio_url, sources[], stt_confidence, session_id}

Phase 3 (FR-11): Accepts optional session_id form field for multi-turn conversation.
"""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from typing import Optional

from models.schemas import SourceCitation, VoiceQueryResponse
from services.generator import get_generator_service
from services.retriever import get_retriever_service
from services.stt import get_stt_service
from services.tts import get_tts_service
from services.session_store import get_session_store

router = APIRouter()

# Max audio file size: 25MB (Groq Whisper limit)
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024


@router.post("/voice-query", response_model=VoiceQueryResponse)
async def voice_query(
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
):
    """
    Full voice pipeline + multi-turn (FR-11):
    1. Resolve/create session for conversation continuity
    2. Transcribe audio via Groq Whisper (Sinhala STT)
    3. Embed transcript + retrieve relevant corpus chunks
    4. Generate grounded Sinhala answer via Gemini Flash (with history context)
    5. Synthesize answer to audio via edge-tts
    6. Persist Q&A turn in session store
    7. Return transcript, answer, audio URL, sources, STT confidence, and session_id

    SDLC Section 10 edge cases handled:
    - Low-confidence transcription: flagged in response, UI shows warning
    - No relevant chunks: honest "no info" response, no hallucination
    - Offensive input: basic heuristic filter before generation
    """
    # Read audio bytes
    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Audio file too large. Maximum size is 25MB.",
        )
    if len(audio_bytes) < 100:
        raise HTTPException(
            status_code=400,
            detail="Audio file is empty or too short.",
        )

    stt = get_stt_service()
    retriever = get_retriever_service()
    generator = get_generator_service()
    tts = get_tts_service()
    session_store = get_session_store()

    # --- Session management (FR-11) ---
    if not session_id or not session_store.session_exists(session_id):
        session_id = session_store.create_session()
    conversation_history = session_store.get_history(session_id)

    # --- Step 1: STT ---
    stt_result = await stt.transcribe(audio_bytes, filename=audio.filename or "audio.webm")
    transcript = stt_result["transcript"]

    if not transcript or len(transcript.strip()) < 2:
        raise HTTPException(
            status_code=422,
            detail="Could not transcribe audio. Please speak clearly in Sinhala or use text input.",
        )

    # --- Offensive content check (before retrieval + generation) ---
    if generator.is_offensive(transcript):
        answer_text = "ඔබේ ප්‍රශ්නයට පිළිතුරු දීමට නොහැකි විය."
        answer_audio_url = await tts.synthesize(answer_text)
        return VoiceQueryResponse(
            transcript=transcript,
            answer_text=answer_text,
            answer_audio_url=answer_audio_url,
            sources=[],
            stt_confidence=stt_result.get("stt_confidence"),
            low_confidence_warning=stt_result.get("low_confidence", False),
            session_id=session_id,
        )

    # --- Step 2: Retrieval ---
    retrieval_result = retriever.retrieve(transcript)

    # --- Step 3: Generation (with conversation history) ---
    answer_text = await generator.generate(
        question=transcript,
        retrieved_chunks=retrieval_result["chunks"],
        has_relevant_results=retrieval_result["has_relevant_results"],
        conversation_history=conversation_history,
    )

    # --- Step 4: TTS ---
    answer_audio_url = await tts.synthesize(answer_text)

    # --- Build source citations ---
    sources = []
    for meta in retrieval_result.get("sources", []):
        sources.append(SourceCitation(
            title=meta.get("title", "Unknown"),
            source=meta.get("source", "unknown"),
            published_date=meta.get("published_date") or None,
        ))

    # --- Persist turn in session history ---
    session_store.add_turn(
        session_id=session_id,
        question=transcript,
        answer=answer_text,
    )

    return VoiceQueryResponse(
        transcript=transcript,
        answer_text=answer_text,
        answer_audio_url=answer_audio_url,
        sources=sources,
        stt_confidence=stt_result.get("stt_confidence"),
        low_confidence_warning=stt_result.get("low_confidence", False),
        session_id=session_id,
    )
