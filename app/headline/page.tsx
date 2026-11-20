"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Countdown, GameTopBar, SoundToggle } from "@/components/GameUI";
import { ResultView, type ReviewItem } from "@/components/ResultView";
import { countChars, HEADLINE_ITEMS } from "@/lib/questions";
import { effectiveCpm, headlinePoints, shuffle } from "@/lib/score";
import { buzz, playCorrect, playFinish, playWrong, unlockAudio } from "@/lib/sound";
import { bestScore, loadHistory, saveResult } from "@/lib/storage";
import type { AnswerLog, HeadlineItem } from "@/lib/types";

const ROUND_SIZE = 5;
/** 3択なので勘で当たる確率は1/3 */
const HEADLINE_CHANCE = 1 / 3;

interface Question {
  item: HeadlineItem;
  /** 表示順に並べた選択肢 */
  choices: string[];
  /** choices の中の正解位置 */
  answer: number;
}

type Phase = "ready" | "countdown" | "playing" | "done";

function buildRound(): Question[] {
  return shuffle(HEADLINE_ITEMS)
    .slice(0, ROUND_SIZE)
    .map((item) => {
      const order = shuffle(item.choices.map((_, i) => i));
      return { item, choices: order.map((i) => item.choices[i]), answer: order.indexOf(item.answer) };
    });
}

export default function HeadlinePage() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [logs, setLogs] = useState<AnswerLog[]>([]);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [lastPoints, setLastPoints] = useState(0);
  const [lastSec, setLastSec] = useState(0);
  const [best, setBest] = useState(0);
  const shownAt = useRef(0);

  function begin() {
    unlockAudio();
    setRound(buildRound());
    setIndex(0);
    setLogs([]);
    setReview([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPicked(null);
    setPhase("countdown");
  }

  const startPlaying = useCallback(() => {
    shownAt.current = performance.now();
    setPhase("playing");
  }, []);

  function choose(i: number) {
    if (picked !== null) return;
    const q = round[index];
    const ms = performance.now() - shownAt.current;
    const chars = countChars(q.item.text);
    const correct = i === q.answer;
    const points = correct ? headlinePoints(chars, ms, combo) : 0;
    const nextCombo = correct ? combo + 1 : 0;

    setPicked(i);
    setLastPoints(points);
    setLastSec(ms / 1000);
    setLogs((l) => [...l, { id: q.item.id, correct, chars, ms }]);
    setScore((s) => s + points);
    setCombo(nextCombo);
    setMaxCombo((m) => Math.max(m, nextCombo));
    if (correct) {
      playCorrect(nextCombo);
    } else {
      playWrong();
      buzz(120);
      setReview((r) => [
        ...r,
        { id: q.item.id, text: q.item.text, yours: q.choices[i], correct: q.choices[q.answer], note: q.item.note },
      ]);
    }
  }

  function goNext() {
    setPicked(null);
    window.scrollTo({ top: 0 });
    if (index + 1 >= round.length) {
      const prevBest = bestScore(loadHistory(), "headline");
      saveResult({
        mode: "headline",
        score,
        correct: logs.filter((l) => l.correct).length,
        total: logs.length,
        effectiveCpm: effectiveCpm(logs, HEADLINE_CHANCE),
        maxCombo,
        at: new Date().toISOString(),
      });
      setBest(Math.max(prevBest, score));
      playFinish();
      setPhase("done");
    } else {
      setIndex(index + 1);
      shownAt.current = performance.now();
    }
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="muted text-sm">
            ← ホーム
          </Link>
          <SoundToggle />
        </div>
        <h1 className="text-3xl font-black">見出しセレクト</h1>
        <div className="card space-y-4 p-5 leading-relaxed">
          <p className="text-lg font-bold">文章を読んで、いちばん合う見出しを選ぼう</p>
          <ol className="space-y-2 text-sm">
            <li>① 300字ほどの文章を読む（全{ROUND_SIZE}問）</li>
            <li>② 3つの見出しから、内容に合うものをタップ</li>
            <li>③ 正解で100点＋速さボーナス（最大100点）</li>
          </ol>
          <p className="muted text-sm">ひっかけの見出しは、本文の一部だけを切り取ったり、逆のことを言ったりしています。</p>
        </div>
        <button className="btn btn-primary w-full py-4 text-xl" onClick={begin}>
          スタート
        </button>
      </div>
    );
  }

  if (phase === "countdown") return <Countdown onDone={startPlaying} />;

  if (phase === "done") {
    return (
      <ResultView
        modeName="見出しセレクト"
        score={score}
        cpm={effectiveCpm(logs, HEADLINE_CHANCE)}
        correct={logs.filter((l) => l.correct).length}
        total={logs.length}
        maxCombo={maxCombo}
        logs={logs}
        best={best}
        review={review}
        onRetry={begin}
      />
    );
  }

  const q = round[index];
  const answered = picked !== null;
  const wasCorrect = answered && picked === q.answer;

  return (
    <div className="space-y-4">
      <GameTopBar />
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-label={`${index + 1}問目 / 全${round.length}問`}>
          {round.map((_, i) => {
            const log = logs[i];
            const bg = log ? (log.correct ? "var(--good)" : "var(--bad)") : i === index ? "var(--accent)" : "var(--line)";
            return <span key={i} className="h-2.5 flex-1 rounded-full" style={{ background: bg }} />;
          })}
        </div>
        <span className="text-xl font-black tabular-nums">{score}点</span>
      </div>

      <div className="card p-5" key={q.item.id}>
        <p className="mb-3 inline-block rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
          {q.item.genre}
        </p>
        <p className="text-[1.05rem] leading-[2]">{q.item.text}</p>
      </div>

      <p className="text-center text-lg font-black">いちばん合う見出しは？</p>
      <div className="space-y-2.5">
        {q.choices.map((c, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === picked;
          const state = !answered ? "idle" : isAnswer ? "good" : isPicked ? "bad" : "dim";
          return (
            <button
              key={c}
              onClick={() => choose(i)}
              disabled={answered}
              className={`card flex w-full items-center gap-3 p-4 text-left text-[1.05rem] font-bold transition active:scale-[0.99] ${
                state === "good" ? "pop" : state === "bad" ? "shake" : state === "dim" ? "opacity-40" : ""
              }`}
              style={{
                borderColor: state === "good" ? "var(--good)" : state === "bad" ? "var(--bad)" : undefined,
                borderWidth: state === "good" || state === "bad" ? 3 : undefined,
                background: state === "good" ? "var(--good-tint)" : state === "bad" ? "var(--bad-tint)" : undefined,
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-black"
                style={{
                  background: state === "good" ? "var(--good)" : state === "bad" ? "var(--bad)" : "var(--line)",
                  color: state === "good" || state === "bad" ? "#fff" : "var(--fg)",
                }}
                aria-hidden
              >
                {state === "good" ? "○" : state === "bad" ? "×" : "ABC"[i]}
              </span>
              <span className="min-w-0 flex-1">{c}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom,0px)]">
          <div
            className="pop mx-auto max-w-md space-y-3 rounded-t-3xl border-t-4 bg-[var(--card)] px-5 pb-5 pt-4 shadow-2xl"
            style={{ borderColor: wasCorrect ? "var(--good)" : "var(--bad)" }}
            aria-live="assertive"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-3xl font-black text-white"
                style={{ background: wasCorrect ? "var(--good)" : "var(--bad)" }}
                aria-hidden
              >
                {wasCorrect ? "○" : "×"}
              </span>
              <div>
                <p className="text-2xl font-black" style={{ color: wasCorrect ? "var(--good)" : "var(--bad)" }}>
                  {wasCorrect ? "正解！" : "ざんねん"}
                </p>
                <p className="muted text-sm tabular-nums">
                  {wasCorrect ? `+${lastPoints}点・` : ""}
                  {lastSec.toFixed(1)}秒で回答
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{q.item.note}</p>
            <button className="btn btn-primary w-full py-3 text-lg" onClick={goNext} autoFocus>
              {index + 1 >= round.length ? "結果を見る" : "次の問題へ"}
            </button>
          </div>
        </div>
      )}
      {answered && <div className="h-56" aria-hidden />}
    </div>
  );
}
