"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Play, Volume2, AlertCircle } from "lucide-react";

interface VoiceRecorderProps {
  onResponse: (data: {
    transcript: string;
    answer_text: string;
    answer_audio_url: string;
    sources: any[];
    stt_confidence?: number;
    low_confidence_warning?: boolean;
    session_id?: string;
  }) => void;
  onError: (error: string) => void;
  onStateChange: (state: "idle" | "recording" | "processing" | "playing") => void;
  currentState: "idle" | "recording" | "processing" | "playing";
  sessionId?: string | null;  // Phase 3: pass session_id with audio upload
}

export default function VoiceRecorder({
  onResponse,
  onError,
  onStateChange,
  currentState,
  sessionId,
}: VoiceRecorderProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Time tracker for recording
  useEffect(() => {
    if (currentState === "recording") {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentState]);

  // Clean up audio visualization loop
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const startVisualization = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64; // Smaller for fewer bars

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        analyserRef.current.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * height;

          // HSL for nice vibrant glow
          const hue = (i / bufferLength) * 120 + 330; // Neon pinks to purples
          ctx.fillStyle = `hsla(${hue}, 85%, 65%, 0.8)`;
          
          // Draw rounded bars
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 4, barHeight, 4);
          ctx.fill();

          x += barWidth;
        }

        animationFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (e) {
      console.warn("Failed to initialize audio visualization:", e);
    }
  };

  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopVisualization();
        // Stop all audio tracks to release the mic icon
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 100) {
          onError("පටිගත කළ ශබ්දය ඉතා කෙටියි. කරුණාකර නැවත උත්සාහ කරන්න.");
          onStateChange("idle");
          return;
        }

        await sendAudioToBackend(audioBlob);
      };

      mediaRecorder.start(200); // chunk every 200ms
      onStateChange("recording");
      startVisualization(stream);
    } catch (err: any) {
      console.error("Mic permission denied or error:", err);
      onError("මයික්‍රෆෝනයට ප්‍රවේශය ප්‍රතික්ෂේප විය. කරුණාකර ටයිප් කර ප්‍රශ්න අසන්න.");
      onStateChange("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      onStateChange("processing");
    }
  };

  const sendAudioToBackend = async (audioBlob: Blob) => {
    onStateChange("processing");
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice_query.webm");
    // Phase 3: include session_id so backend continues the conversation
    if (sessionId) {
      formData.append("session_id", sessionId);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    try {
      const response = await fetch(`${apiUrl}/api/voice-query`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Server error" }));
        throw new Error(errData.detail || "පිළිතුරක් ලබා ගැනීමට අපොහොසත් විය.");
      }

      const result = await response.json();
      onResponse(result);
    } catch (err: any) {
      console.error("API error:", err);
      onError(err.message || "සේවාදායකය සමඟ සම්බන්ධ වීමට නොහැක. කරුණාකර නැවත උත්සාහ කරන්න.");
      onStateChange("idle");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 w-full max-w-md mx-auto">
      {/* Animated Visualizer or State Indicator */}
      <div className="relative flex items-center justify-center w-64 h-24 rounded-2xl bg-zinc-950/40 border border-zinc-800/50 shadow-inner overflow-hidden backdrop-blur-md">
        {currentState === "recording" && (
          <canvas
            ref={canvasRef}
            width={240}
            height={80}
            className="absolute inset-0 w-full h-full opacity-80"
          />
        )}

        {currentState === "idle" && (
          <div className="text-zinc-500 text-sm font-medium tracking-wide flex items-center gap-2">
            <Mic className="w-4 h-4 animate-pulse" />
            කතා කිරීමට බොත්තම ඔබන්න
          </div>
        )}

        {currentState === "recording" && (
          <div className="absolute top-2 right-3 text-red-500 text-xs font-mono font-semibold tracking-widest flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            REC {formatTime(recordingTime)}
          </div>
        )}

        {currentState === "processing" && (
          <div className="flex flex-col items-center gap-2 text-violet-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs font-medium animate-pulse">හඳුනාගනිමින් පවතී...</span>
          </div>
        )}

        {currentState === "playing" && (
          <div className="flex flex-col items-center gap-2 text-emerald-400">
            <Volume2 className="w-6 h-6 animate-bounce" />
            <span className="text-xs font-medium">පිළිතුර වාදනය වේ...</span>
          </div>
        )}
      </div>

      {/* Record button */}
      <div className="relative">
        {currentState === "recording" ? (
          <button
            onClick={stopRecording}
            className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border-4 border-red-950/30 group"
            title="නතර කරන්න"
          >
            <Square className="w-8 h-8 fill-current group-hover:scale-90 transition-transform" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={currentState === "processing"}
            className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none transition-all duration-300 border-4 border-violet-950/30 group"
            title="කතා කරන්න"
          >
            <Mic className="w-8 h-8 group-hover:scale-110 transition-transform" />
            {currentState === "idle" && (
              <span className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping -z-10 group-hover:bg-violet-500/30" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
