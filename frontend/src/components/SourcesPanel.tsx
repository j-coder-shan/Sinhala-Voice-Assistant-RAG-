"use client";

import React from "react";
import { BookOpen, Calendar, ShieldCheck } from "lucide-react";

interface Source {
  title: string;
  source: string;
  published_date?: string | null;
}

interface SourcesPanelProps {
  sources: Source[];
  compact?: boolean;  // Phase 3: compact inline mode for chat turn cards
}

export default function SourcesPanel({ sources, compact = false }: SourcesPanelProps) {
  if (!sources || sources.length === 0) return null;

  // De-duplicate sources by title
  const uniqueSources = sources.reduce((acc: Source[], current) => {
    const x = acc.find((item) => item.title === current.title);
    if (!x) {
      acc.push(current);
    }
    return acc;
  }, []);

  // Compact variant: small inline list for inside chat turn cards
  if (compact) {
    return (
      <div className="space-y-1.5">
        {uniqueSources.map((source, index) => (
          <div
            key={index}
            className="flex items-start gap-2 px-3 py-2 rounded-xl bg-zinc-950/50 border border-zinc-800/40 text-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-zinc-300 font-medium line-clamp-1">{source.title}</p>
              <p className="text-zinc-500 mt-0.5">
                {source.source === "NSINA" ? "NSINA News" : source.source === "sinhala_wikipedia" ? "Wikipedia" : source.source}
                {source.published_date && ` · ${source.published_date}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-zinc-900/40 border border-zinc-800/40 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
      <div className="flex items-center gap-2 text-violet-400">
        <BookOpen className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">ගොඩනැඟූ මූලාශ්‍ර (Grounded Sources)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {uniqueSources.map((source, index) => (
          <div
            key={index}
            className="flex flex-col justify-between p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800/30 hover:border-violet-500/20 transition-all duration-300 shadow-sm hover:shadow-md group"
          >
            <div className="space-y-2">
              {/* Title */}
              <h4 className="text-sm font-semibold text-zinc-300 group-hover:text-zinc-200 line-clamp-2 leading-relaxed">
                {source.title}
              </h4>
            </div>

            {/* Tags & Metadata */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-800/50 text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-violet-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                {source.source === "NSINA" ? "NSINA News" : source.source === "sinhala_wikipedia" ? "Wikipedia" : source.source}
              </span>
              
              {source.published_date && (
                <span className="inline-flex items-center gap-1 text-zinc-500 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  {source.published_date}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
