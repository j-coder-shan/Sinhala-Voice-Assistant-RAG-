"use client";

import React, { useRef, useEffect, useState } from "react";
import { Play, Pause, AlertCircle, RefreshCw, Volume2 } from "lucide-react";

interface TranscriptViewProps {
  transcript: string | null;
  answer: string | null;
  audioUrl: string | null;
  sttConfidence: number | null;
  lowConfidenceWarning: boolean;
  onPlaybackStateChange: (isPlaying: boolean) => void;
  onRetry: () => void;
}

export default function TranscriptView({
  transcript,
  answer,
  audioUrl,
  sttConfidence,
  lowConfidenceWarning,
  onPlaybackStateChange,
  onRetry,
}: TranscriptViewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Auto-play audio when audioUrl changes
  useEffect(() => {
    if (audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const fullAudioUrl = audioUrl.startsWith("http") ? audioUrl : `${apiUrl}${audioUrl}`;
      const audio = new Audio(fullAudioUrl);
      audioRef.current = audio;

      audio.addEventListener("canplaythrough", () => {
        audio.play().catch((e) => {
          console.warn("Autoplay blocked by browser. User must click Play.", e);
        });
      });

      audio.addEventListener("play", () => {
        setIsPlaying(true);
        onPlaybackStateChange(true);
      });

      audio.addEventListener("pause", () => {
        setIsPlaying(false);
        onPlaybackStateChange(false);
      });

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        onPlaybackStateChange(false);
        setCurrentTime(0);
      });

      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
      });

      return () => {
        audio.pause();
        audioRef.current = null;
        setIsPlaying(false);
        onPlaybackStateChange(false);
      };
    }
  }, [audioUrl, apiUrl, onPlaybackStateChange]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error("Playback error:", err));
    }
  };

  const formatAudioTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!transcript && !answer) return null;

  return (
    <div className="w-full max-w-2xl bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Transcript Block */}
      {transcript && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">ඔබ ඇසූ ප්‍රශ්නය (Transcript)</span>
            {sttConfidence !== null && (
              <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full border ${
                lowConfidenceWarning
                  ? "bg-amber-950/30 text-amber-400 border-amber-800/50"
                  : "bg-emerald-950/30 text-emerald-400 border-emerald-800/50"
              }`}>
                හඳුනාගැනීමේ විශ්වාසය: {(sttConfidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
          
          <div className="p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/40 text-lg font-medium text-zinc-200">
            {transcript}
          </div>

          {/* Low confidence warnings */}
          {lowConfidenceWarning && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">මයික්‍රෆෝනයෙන් ලබාගත් හඬ අපැහැදිලි විය හැක.</p>
                <p className="text-xs text-amber-400/85">වැරදි වචන ඇත්නම්, කරුණාකර පහතින් නිවැරදි ප්‍රශ්නය ටයිප් කරන්න හෝ නැවත උත්සාහ කරන්න.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Answer Block */}
      {answer && (
        <div className="space-y-3 pt-2 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">සහකාරයාගේ පිළිතුර (Answer)</span>
            
            {audioUrl && (
              <button
                onClick={togglePlayback}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30 hover:scale-102 active:scale-98 transition-all duration-200"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    නතර කරන්න
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    හඬ අහන්න
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-zinc-950/60 to-zinc-950/30 border border-zinc-800/30 text-lg leading-relaxed text-zinc-100 font-normal">
            {answer}
          </div>

          {/* Simple audio controller progress bar */}
          {audioUrl && duration > 0 && (
            <div className="flex items-center gap-3 px-2 py-1 bg-zinc-950/40 rounded-xl border border-zinc-800/30">
              <Volume2 className="w-4 h-4 text-emerald-400/80 flex-shrink-0" />
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-100"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0 select-none">
                {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
