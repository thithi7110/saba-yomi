"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResultView, type ReviewItem } from "@/components/ResultView";
import { countChars, SORT_CARDS, topicById } from "@/lib/questions";
import { effectiveCpm, rushPoints, shuffle } from "@/lib/score";
import { bestScore, loadHistory, saveResult } from "@/lib/storage";
import type { AnswerLog, Side, SortCard } from "@/lib/types";

const DURATION_MS = 60_000;
const SWIPE_THRESHOLD = 80;
/** 2択なので勘で当たる確率は1/2 */
const RUSH_CHANCE = 1 / 2;

type Phase = "ready" | "playing" | "done";

export default function RushPage() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [deck, setDeck] = useState<SortCard[]>([]);
  const [index, setIndex] = useState(0);
  const [logs, setLogs] = useState<AnswerLog[]>([]);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [remaining, setRemaining] = useState(DURATION_MS);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [best, setBest] = useState(0);

  const startedAt = useRef(0);
  const shownAt = useRef(0);
  const dragStart = useRef<number | null>(null);
  const finished = useRef(false);

  const finish = useCallback(
    (finalLogs: AnswerLog[], finalScore: number, finalMaxCombo: number) => {
      if (finished.current) return;
      finished.current = true;
      const prevBest = bestScore(loadHistory(), "rush");
      saveResult({
        mode: "rush",
        score: finalScore,
        correct: finalLogs.filter((l) => l.correct).length,
        total: finalLogs.length,
        effectiveCpm: effectiveCpm(finalLogs, RUSH_CHANCE),
        maxCombo: finalMaxCombo,
        at: new Date().toISOString(),
      });
      setBest(Math.max(prevBest, finalScore));
      setPhase("done");
    },
    [],
  );

  function start() {
    finished.current = false;
    setDeck(shuffle(SORT_CARDS));
    setIndex(0);
    setLogs([]);
    setReview([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setRemaining(DURATION_MS);
    setDragX(0);
    startedAt.current = performance.now();
    shownAt.current = performance.now();
    setPhase("playing");
  }

  // 残り時間のタイマー
  const stateRef = useRef({ logs, score, maxCombo });
  stateRef.current = { logs, score, maxCombo };
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const left = DURATION_MS - (performance.now() - startedAt.current);
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        const s = stateRef.current;
        finish(s.logs, s.score, s.maxCombo);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, finish]);

  const answer = useCallback(
    (side: Side) => {
      if (phase !== "playing" || finished.current) return;
      const card = deck[index];
      if (!card) return;
      const now = performance.now();
      const correct = card.answer === side;
      const log: AnswerLog = { id: card.id, correct, chars: countChars(card.text), ms: now - shownAt.current };
      const nextLogs = [...logs, log];
      const nextCombo = correct ? combo + 1 : 0;
      const nextScore = correct ? score + rushPoints(log.chars, combo) : score;
      const nextMax = Math.max(maxCombo, nextCombo);
      const topic = topicById(card.topic);

      setLogs(nextLogs);
      setCombo(nextCombo);
      setScore(nextScore);
      setMaxCombo(nextMax);
      setFlash(correct ? "good" : "bad");
      setTimeout(() => setFlash(null), 250);
      if (!correct) {
        setReview((r) => [
          ...r,
          {
            id: card.id,
            text: card.text,
            yours: topic[side],
            correct: topic[card.answer],
            note: card.note,
          },
        ]);
      }
      shownAt.current = now;
      setDragX(0);
      if (index + 1 >= deck.length) {
        finish(nextLogs, nextScore, nextMax);
      } else {
        setIndex(index + 1);
      }
    },
    [phase, deck, index, logs, combo, score, maxCombo, finish],
  );

  // キーボード（PC用）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") answer("left");
      if (e.key === "ArrowRight") answer("right");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <BackLink />
        <h1 className="text-2xl font-black">仕分けラッシュ</h1>
        <div className="card space-y-3 p-5 text-sm leading-relaxed">
          <p>60秒で、流れてくる短い文をどんどん仕分けよう。</p>
          <p>
            カードの上に出る<b>お題</b>を見て、左右にスワイプ（またはボタン／←→キー）で答えます。
          </p>
          <p className="muted">連続正解でコンボ倍率アップ。まちがえても減点はありません。</p>
        </div>
        <button className="btn btn-primary w-full text-lg" onClick={start}>
          スタート
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <ResultView
        modeName="仕分けラッシュ"
        score={score}
        cpm={effectiveCpm(logs, RUSH_CHANCE)}
        correct={logs.filter((l) => l.correct).length}
        total={logs.length}
        maxCombo={maxCombo}
        logs={logs}
        best={best}
        review={review}
        onRetry={start}
      />
    );
  }

  const card = deck[index];
  const topic = topicById(card.topic);
  const pct = (remaining / DURATION_MS) * 100;
  const lean = dragX > 30 ? "right" : dragX < -30 ? "left" : null;

  return (
    <div className="flex min-h-[85dvh] flex-col gap-4 select-none">
      <div className="flex items-center justify-between text-sm">
        <span className="tabular-nums font-bold">{score}点</span>
        <span className={`tabular-nums ${combo >= 3 ? "pop font-black text-[var(--accent)]" : "muted"}`} key={combo}>
          {combo >= 2 ? `${combo}コンボ` : ""}
        </span>
        <span className="tabular-nums muted">{Math.ceil(remaining / 1000)}秒</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-100" style={{ width: `${pct}%` }} />
      </div>

      <p className="text-center font-bold" key={`q-${card.id}`}>
        {topic.question}
      </p>

      <div
        key={card.id}
        className={`card pop flex flex-1 touch-none items-center p-6 text-lg leading-relaxed ${flash === "bad" ? "shake" : ""}`}
        style={{
          transform: `translateX(${dragX}px) rotate(${dragX / 25}deg)`,
          borderColor: flash === "good" ? "var(--good)" : flash === "bad" ? "var(--bad)" : undefined,
          borderWidth: flash ? 3 : undefined,
        }}
        onPointerDown={(e) => {
          dragStart.current = e.clientX;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragStart.current !== null) setDragX(e.clientX - dragStart.current);
        }}
        onPointerUp={() => {
          const dx = dragX;
          dragStart.current = null;
          if (dx > SWIPE_THRESHOLD) answer("right");
          else if (dx < -SWIPE_THRESHOLD) answer("left");
          else setDragX(0);
        }}
        onPointerCancel={() => {
          dragStart.current = null;
          setDragX(0);
        }}
      >
        <p>{card.text}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          className={`btn btn-ghost text-lg ${lean === "left" ? "ring-2 ring-[var(--accent)]" : ""}`}
          onClick={() => answer("left")}
        >
          ← {topic.left}
        </button>
        <button
          className={`btn btn-ghost text-lg ${lean === "right" ? "ring-2 ring-[var(--accent)]" : ""}`}
          onClick={() => answer("right")}
        >
          {topic.right} →
        </button>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="muted text-sm">
      ← ホーム
    </Link>
  );
}
