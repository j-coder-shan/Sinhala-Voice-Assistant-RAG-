"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Send,
  ShieldAlert,
  Database,
  RefreshCw,
  HelpCircle,
  Sparkles,
  MessageSquare,
  Trash2,
  Volume2,
  AlertTriangle,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import VoiceRecorder from "../components/VoiceRecorder";
import SourcesPanel from "../components/SourcesPanel";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CorpusStats {
  last_refreshed: string | null;
  document_count: number;
  chunk_count: number;
}

interface Source {
  title: string;
  source: string;
  published_date?: string | null;
}

interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  audioUrl?: string | null;
  sources?: Source[];
  sttConfidence?: number | null;
  lowConfidenceWarning?: boolean;
  transliterated?: string | null;
  timestamp: number;
}

// ─── Audio Player Hook ───────────────────────────────────────────────────────

function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const play = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingUrl(url);
    audio.onended = () => setPlayingUrl(null);
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlayingUrl(null);
  };

  return { play, stop, playingUrl };
}

// ─── Turn Card ───────────────────────────────────────────────────────────────

function TurnCard({
  turn,
  onPlayAudio,
  playingUrl,
}: {
  turn: ConversationTurn;
  onPlayAudio: (url: string) => void;
  playingUrl: string | null;
}) {
  const [showSources, setShowSources] = useState(false);
  const isPlaying = turn.audioUrl && playingUrl === turn.audioUrl;

  if (turn.role === "user") {
    return (
      <div className="flex justify-end animate-in slide-in-from-bottom-2 duration-300">
        <div className="max-w-[80%] space-y-1">
          {turn.transliterated && (
            <p className="text-right text-xs text-violet-400/70 pr-1">
              → {turn.transliterated}
            </p>
          )}
          {turn.lowConfidenceWarning && (
            <div className="flex items-center gap-1 justify-end text-amber-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span>Low confidence transcription</span>
            </div>
          )}
          <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-sm shadow-lg shadow-violet-900/30">
            <p className="leading-relaxed">{turn.text}</p>
            {turn.sttConfidence !== null && turn.sttConfidence !== undefined && (
              <p className="text-xs text-violet-200/60 mt-1.5 text-right">
                STT: {(turn.sttConfidence * 100).toFixed(0)}%
              </p>
            )}
          </div>
          <p className="text-right text-xs text-zinc-600 pr-1">
            {new Date(turn.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  }

  // Assistant turn
  return (
    <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300">
      <div className="max-w-[85%] space-y-2">
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-900/70 border border-zinc-800/60 text-zinc-100 text-sm shadow-lg backdrop-blur-md">
          <p className="leading-relaxed">{turn.text}</p>

          {/* Controls row */}
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-zinc-800/50">
            {turn.audioUrl && (
              <button
                onClick={() => onPlayAudio(turn.audioUrl!)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all duration-200 ${
                  isPlaying
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-800/60 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-zinc-700/40"
                }`}
                title="Play audio"
              >
                <Volume2 className={`w-3.5 h-3.5 ${isPlaying ? "animate-pulse" : ""}`} />
                {isPlaying ? "වාදනය වේ..." : "හඬ ඇසෙන්න"}
              </button>
            )}

            {turn.sources && turn.sources.length > 0 && (
              <button
                onClick={() => setShowSources((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-800/60 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 border border-zinc-700/40 transition-all duration-200"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {turn.sources.length} මූලාශ්‍ර
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${showSources ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Inline sources */}
        {showSources && turn.sources && turn.sources.length > 0 && (
          <div className="pl-2">
            <SourcesPanel sources={turn.sources} compact />
          </div>
        )}

        <p className="text-xs text-zinc-600 pl-1">
          {new Date(turn.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-200">
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-900/70 border border-zinc-800/60 shadow-lg backdrop-blur-md">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-violet-500/60"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
          <span className="text-xs text-zinc-500 ml-1">සිතමින්...</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<"idle" | "recording" | "processing" | "playing">("idle");
  const [textInput, setTextInput] = useState("");

  // Session state (Phase 3 / FR-11)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);

  // Corpus management
  const [corpusStats, setCorpusStats] = useState<CorpusStats | null>(null);
  const [refreshingCorpus, setRefreshingCorpus] = useState(false);
  const [corpusMessage, setCorpusMessage] = useState<string | null>(null);

  // Error & UI
  const [error, setError] = useState<string | null>(null);

  const { play, stop, playingUrl } = useAudioPlayer();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const SUGGESTED_QUESTIONS = [
    { text: "ශ්‍රී ලංකාවේ ජනාධිපති කවුද?", label: "ජනාධිපති" },
    { text: "සිංහල භාෂාව යනු කුමක්ද?", label: "සිංහල භාෂාව" },
    { text: "ශ්‍රී ලංකාව පිහිටා ඇත්තේ කොහේද?", label: "ලංකාවේ පිහිටීම" },
    { text: "ශ්‍රී ලංකාවේ ජනගහනය කීයද?", label: "ජනගහනය" },
  ];

  // Load corpus stats on mount
  useEffect(() => {
    fetchCorpusStats();
  }, []);

  // Auto-scroll on new conversation entries
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, appState]);

  const fetchCorpusStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/corpus/status`);
      if (response.ok) setCorpusStats(await response.json());
    } catch (err) {
      console.warn("Failed to load corpus status:", err);
    }
  };

  const triggerCorpusRefresh = async () => {
    setRefreshingCorpus(true);
    setCorpusMessage("මූලාශ්‍ර දත්ත සමුදාය යාවත්කාලීන වෙමින් පවතී...");
    try {
      const response = await fetch(`${apiUrl}/api/corpus/refresh`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setCorpusMessage(data.message || "යාවත්කාලීන කිරීම සාර්ථකයි!");
        fetchCorpusStats();
      } else {
        throw new Error("යාවත්කාලීන කිරීම අසාර්ථක විය.");
      }
    } catch (err: any) {
      setError(err.message || "දත්ත සමුදාය යාවත්කාලීන කිරීමේ දෝෂයකි.");
    } finally {
      setRefreshingCorpus(false);
      setTimeout(() => setCorpusMessage(null), 8000);
    }
  };

  const clearConversation = async () => {
    if (sessionId) {
      try {
        await fetch(`${apiUrl}/api/sessions/${sessionId}`, { method: "DELETE" });
      } catch {
        // ignore
      }
    }
    setSessionId(null);
    setConversation([]);
    setError(null);
    stop();
  };

  // ── Voice response handler ────────────────────────────────────────────────

  const handleVoiceResponse = (data: any) => {
    setError(null);

    // Update session_id if the backend started a new one
    if (data.session_id && data.session_id !== sessionId) {
      setSessionId(data.session_id);
    }

    // User turn already added in startRecording path — this adds the assistant turn
    const assistantTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: data.answer_text,
      audioUrl: data.answer_audio_url ? `${apiUrl}/${data.answer_audio_url}` : null,
      sources: data.sources || [],
      timestamp: Date.now(),
    };
    setConversation((prev) => [...prev, assistantTurn]);
    setAppState("playing");

    // Auto-play the response
    if (data.answer_audio_url) {
      play(`${apiUrl}/${data.answer_audio_url}`);
    }
  };

  // We need to add a user turn when recording starts, but we only know the
  // transcript after STT.  So we add a placeholder user turn, then the
  // VoiceRecorder fires onResponse with transcript + answer.
  // Actually, simpler: add user turn when response arrives (transcript is in data).
  const handleVoiceResponseWithTranscript = (data: any) => {
    setError(null);
    if (data.session_id && data.session_id !== sessionId) {
      setSessionId(data.session_id);
    }

    const userTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      role: "user",
      text: data.transcript,
      sttConfidence: data.stt_confidence ?? null,
      lowConfidenceWarning: data.low_confidence_warning ?? false,
      timestamp: Date.now(),
    };

    const assistantTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: data.answer_text,
      audioUrl: data.answer_audio_url ? `${apiUrl}/${data.answer_audio_url}` : null,
      sources: data.sources || [],
      timestamp: Date.now() + 1,
    };

    setConversation((prev) => [...prev, userTurn, assistantTurn]);
    setAppState("playing");

    if (data.answer_audio_url) {
      play(`${apiUrl}/${data.answer_audio_url}`);
    }
  };

  // ── Text query handler ────────────────────────────────────────────────────

  const handleTextQuerySubmit = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToSend = customQuery || textInput;
    if (!queryToSend.trim()) return;

    setAppState("processing");
    setError(null);

    const userTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      role: "user",
      text: queryToSend,
      timestamp: Date.now(),
    };
    setConversation((prev) => [...prev, userTurn]);
    if (!customQuery) setTextInput("");

    try {
      const response = await fetch(`${apiUrl}/api/text-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryToSend, session_id: sessionId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Server error" }));
        throw new Error(errData.detail || "පිළිතුරක් ලබා ගැනීමට අපොහොසත් විය.");
      }

      const data = await response.json();

      // Update session_id
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
      }

      // Update user turn text if transliterated
      if (data.transliterated_question) {
        setConversation((prev) =>
          prev.map((t) =>
            t.id === userTurn.id
              ? { ...t, transliterated: data.transliterated_question }
              : t
          )
        );
      }

      const assistantTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.answer_text,
        audioUrl: data.answer_audio_url ? `${apiUrl}/${data.answer_audio_url}` : null,
        sources: data.sources || [],
        timestamp: Date.now(),
      };
      setConversation((prev) => [...prev, assistantTurn]);
      setAppState("playing");

      if (data.answer_audio_url) {
        play(`${apiUrl}/${data.answer_audio_url}`);
      }
    } catch (err: any) {
      console.error("Text query error:", err);
      setError(err.message || "සේවාදායකය සමඟ සම්බන්ධ වීමට නොහැක.");
      setAppState("idle");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-violet-500/30">
      {/* Background glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-1/2 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-900/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>RAG AI</span>
            </div>
            <h1 className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">
              සිංහල හඬ සහකාරයා
            </h1>
          </div>

          {/* Session indicator + clear */}
          <div className="flex items-center gap-2">
            {sessionId && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                <MessageSquare className="w-3 h-3 text-violet-500" />
                <span className="text-violet-400">{conversation.length / 2 | 0} turns</span>
              </div>
            )}
            {conversation.length > 0 && (
              <button
                onClick={clearConversation}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-red-950/40 border border-zinc-800/50 hover:border-red-800/40 text-zinc-400 hover:text-red-400 transition-all duration-200"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col px-4 pb-2">

        {/* ── Welcome / Empty State ── */}
        {conversation.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 space-y-8 text-center">
            <div className="space-y-3">
              <p className="text-zinc-400 text-base max-w-lg">
                සිංහල භාෂාවෙන් ප්‍රශ්න අසන්න — ඔබේ හඬ හෝ ටයිප් කිරීම මඟින්
                RAG-grounded පිළිතුරු ලබාගන්න.
              </p>
            </div>

            {/* Limitations notice */}
            <div className="max-w-md bg-zinc-900/30 border border-zinc-800/40 rounded-2xl p-4 flex gap-3 text-left text-xs text-zinc-400">
              <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-zinc-300">Limitations Notice:</span>
                <p>
                  සිංහල යනු Low-resource language. Whisper STT සමහරවිට
                  අපැහැදිලි විය හැක. Confidence score + sources සපයා ඇත.
                </p>
              </div>
            </div>

            {/* Sample questions */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                <HelpCircle className="w-3.5 h-3.5" />
                උදාහරණ ප්‍රශ්න:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTextQuerySubmit(undefined, q.text)}
                    disabled={appState === "processing"}
                    className="px-4 py-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-violet-500/30 text-zinc-400 hover:text-violet-300 text-sm transition-all duration-200 hover:shadow-lg hover:shadow-violet-900/10"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Conversation Log ── */}
        {conversation.length > 0 && (
          <div className="flex-1 overflow-y-auto py-6 space-y-4 min-h-0">
            {conversation.map((turn) => (
              <TurnCard
                key={turn.id}
                turn={turn}
                onPlayAudio={play}
                playingUrl={playingUrl}
              />
            ))}

            {/* Typing / thinking indicator */}
            {appState === "processing" && <TypingIndicator />}

            <div ref={chatBottomRef} />
          </div>
        )}

        {/* ── Error Banner ── */}
        {error && (
          <div className="my-3 p-4 rounded-2xl bg-red-950/20 border border-red-800/30 text-red-400 text-sm text-center font-medium">
            {error}
          </div>
        )}

        {/* ── Input Area (sticky at bottom) ── */}
        <div className="sticky bottom-0 pb-4 pt-3 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-900/60">
          {/* Voice Recorder (compact inline) */}
          <div className="flex items-end gap-3 w-full">
            <VoiceRecorder
              onResponse={handleVoiceResponseWithTranscript}
              onError={(err) => setError(err)}
              onStateChange={(state) => {
                setAppState(state);
                if (state === "idle") stop();
              }}
              currentState={appState}
              sessionId={sessionId}
            />

            {/* Text input */}
            <form
              onSubmit={handleTextQuerySubmit}
              className="flex-1 flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 shadow-xl focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all duration-300 backdrop-blur-xl"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="ප්‍රශ්නය ටයිප් කරන්න..."
                className="flex-1 bg-transparent px-3 py-2.5 text-zinc-200 placeholder-zinc-500 focus:outline-none text-sm"
                disabled={appState === "processing" || appState === "recording"}
              />
              <button
                type="submit"
                disabled={!textInput.trim() || appState === "processing" || appState === "recording"}
                className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 hover:scale-105 active:scale-95 transition-all duration-200 flex-shrink-0"
                title="ප්‍රශ්නය යවන්න"
              >
                {appState === "processing" ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>

          {/* Suggested questions row (when conversation is active) */}
          {conversation.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 items-center">
              <span className="text-xs text-zinc-600 font-medium flex items-center gap-1">
                <HelpCircle className="w-3 h-3" />
                සුරාව:
              </span>
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTextQuerySubmit(undefined, q.text)}
                  disabled={appState === "processing" || appState === "recording"}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/50 hover:border-zinc-700/60 text-zinc-500 hover:text-zinc-300 text-xs transition-all duration-200"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer Corpus Stats ── */}
      <footer className="border-t border-zinc-900/60 py-3">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-zinc-600" />
            {corpusStats ? (
              <>
                <span>
                  ලේඛන:{" "}
                  <strong className="text-zinc-400">{corpusStats.document_count}</strong>
                </span>
                <span className="text-zinc-700">·</span>
                <span>
                  Chunks:{" "}
                  <strong className="text-zinc-400">{corpusStats.chunk_count}</strong>
                </span>
                {corpusStats.last_refreshed && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="font-mono">
                      {new Date(corpusStats.last_refreshed).toLocaleDateString()}
                    </span>
                  </>
                )}
              </>
            ) : (
              "Loading corpus status..."
            )}
          </div>

          <button
            onClick={triggerCorpusRefresh}
            disabled={refreshingCorpus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-zinc-700/60 text-zinc-400 hover:text-zinc-300 disabled:opacity-50 transition-all duration-200"
            title="Refresh corpus"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingCorpus ? "animate-spin" : ""}`} />
            යාවත්කාලීන කරන්න
          </button>
        </div>
      </footer>

      {/* Corpus refresh toast */}
      {corpusMessage && (
        <div className="fixed bottom-20 right-4 max-w-sm p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl text-xs text-violet-400 font-medium z-50">
          {corpusMessage}
        </div>
      )}

      {/* Bounce keyframes */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
