"use client";

import Link from "next/link";
import { useState } from "react";
import { rankFor, shareText } from "@/lib/score";
import type { AnswerLog } from "@/lib/types";

export interface ReviewItem {
  id: string;
  text: string;
  yours: string;
  correct: string;
  note: string;
}

interface Props {
  modeName: string;
  score: number;
  cpm: number;
  correct: number;
  total: number;
  maxCombo: number;
  logs: AnswerLog[];
  best: number;
  review: ReviewItem[];
  onRetry: () => void;
}

export function ResultView(p: Props) {
  const [copied, setCopied] = useState(false);
  const rank = rankFor(p.cpm);
  const isBest = p.score > 0 && p.score >= p.best;

  async function share() {
    const text = shareText({ modeName: p.modeName, score: p.score, cpm: p.cpm, logs: p.logs });
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 共有キャンセル時は何もしない
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-6 text-center">
        <p className="muted text-sm">{p.modeName}</p>
        <p className="pop mt-1 text-5xl font-black tabular-nums">{p.score}</p>
        <p className="muted text-sm">点{isBest && <span className="ml-2 font-bold text-[var(--accent)]">自己ベスト！</span>}</p>
        <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <Stat label="実効読速" value={`${p.cpm}`} unit="字/分" />
          <Stat label="正解" value={`${p.correct}/${p.total}`} />
          <Stat label="最大コンボ" value={`${p.maxCombo}`} />
        </div>
        <p className="mt-5 text-lg font-bold">
          {rank.emoji} {rank.name}
        </p>
        <p className="mt-2 text-2xl tracking-tight">{p.logs.map((l) => (l.correct ? "🟩" : "🟥")).join("")}</p>
      </div>

      <div className="flex gap-3">
        <button className="btn btn-primary flex-1" onClick={p.onRetry}>
          もう1回
        </button>
        <button className="btn btn-ghost flex-1" onClick={share}>
          {copied ? "コピーしました" : "結果をシェア"}
        </button>
      </div>
      <Link href="/" className="btn btn-ghost block text-center">
        ホームへ
      </Link>

      {p.review.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">まちがえた問題</h2>
          {p.review.map((r) => (
            <div key={r.id} className="card p-4 text-sm leading-relaxed">
              <p>{r.text}</p>
              <p className="mt-2">
                <span className="text-[var(--bad)]">あなた: {r.yours}</span>
                <span className="mx-2 muted">→</span>
                <span className="font-bold text-[var(--good)]">正解: {r.correct}</span>
              </p>
              <p className="muted mt-1">{r.note}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-2">
      <p className="muted text-xs">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {unit && <p className="muted text-xs">{unit}</p>}
    </div>
  );
}
