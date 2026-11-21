"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isMuted, playTick, setMuted, unlockAudio } from "@/lib/sound";

/** 音のオン・オフ切り替え */
export function SoundToggle() {
  const [muted, setM] = useState(false);
  useEffect(() => setM(isMuted()), []);
  return (
    <button
      type="button"
      aria-label={muted ? "音をオンにする" : "音をオフにする"}
      className="rounded-full border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-sm"
      onClick={() => {
        setMuted(!muted);
        setM(!muted);
        if (muted) unlockAudio();
      }}
    >
      {muted ? "🔇 音なし" : "🔊 音あり"}
    </button>
  );
}

/** プレイ画面の上部バー：やめる・音 */
export function GameTopBar() {
  return (
    <div className="flex items-center justify-between">
      <Link href="/" className="muted text-sm">
        ✕ やめる
      </Link>
      <SoundToggle />
    </div>
  );
}

/** 3・2・1 のカウントダウン */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n === 0) {
      playTick(true);
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
    playTick();
    const t = setTimeout(() => setN(n - 1), 650);
    return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <p key={n} className="pop text-8xl font-black text-[var(--accent)]">
        {n === 0 ? "スタート！" : n}
      </p>
    </div>
  );
}

export interface Feedback {
  correct: boolean;
  /** 正解時の加点 */
  points?: number;
  combo?: number;
  /** 速く読めた（スピードボーナス） */
  fast?: boolean;
  /** むずかしいカードだった */
  hard?: boolean;
  /** 不正解で減った残り時間（秒） */
  penaltySec?: number;
  /** 不正解時に見せる正しい答え */
  answer?: string;
  note?: string;
}

/**
 * 正解・不正解を画面いっぱいに見せる。
 * 不正解のときは正しい答えと解説を出し、タップで先へ進める。
 */
export function FeedbackOverlay({ fb, onSkip }: { fb: Feedback; onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-live="assertive"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 px-6 text-center"
      style={{ background: fb.correct ? "var(--good-tint)" : "var(--bad-tint)" }}
    >
      <span
        className="pop flex h-36 w-36 items-center justify-center rounded-full text-8xl font-black text-white shadow-xl"
        style={{ background: fb.correct ? "var(--good)" : "var(--bad)" }}
        aria-hidden
      >
        {fb.correct ? "○" : "×"}
      </span>
      <p className="pop text-3xl font-black" style={{ color: fb.correct ? "var(--good)" : "var(--bad)" }}>
        {fb.correct ? "正解！" : "ざんねん"}
      </p>
      {fb.correct && fb.points !== undefined && (
        <p className="text-xl font-bold tabular-nums">
          +{fb.points}点{fb.combo && fb.combo >= 2 ? `　${fb.combo}コンボ🔥` : ""}
        </p>
      )}
      {fb.correct && (fb.fast || fb.hard) && (
        <p className="flex gap-2 text-sm font-bold">
          {fb.fast && <span className="rounded-full bg-[var(--card)] px-3 py-1">⚡ はやい！</span>}
          {fb.hard && <span className="rounded-full bg-[var(--card)] px-3 py-1">💪 むずかしい</span>}
        </p>
      )}
      {!fb.correct && fb.penaltySec && (
        <p className="text-xl font-black tabular-nums text-[var(--bad)]">残り時間 −{fb.penaltySec}秒</p>
      )}
      {!fb.correct && (
        <div className="card max-w-sm space-y-2 p-4 text-left">
          {fb.answer && (
            <p className="text-lg">
              正解は <b className="text-[var(--good)]">「{fb.answer}」</b>
            </p>
          )}
          {fb.note && <p className="muted text-sm leading-relaxed">{fb.note}</p>}
        </div>
      )}
      {!fb.correct && <p className="muted mt-2 text-sm">タップで次へ</p>}
    </button>
  );
}
