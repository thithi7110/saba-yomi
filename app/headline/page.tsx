"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ResultView, type ReviewItem } from "@/components/ResultView";
import { countChars, HEADLINE_ITEMS } from "@/lib/questions";
import { effectiveCpm, headlinePoints, shuffle } from "@/lib/score";
import { bestScore, loadHistory, saveResult } from "@/lib/storage";
import type { AnswerLog, HeadlineItem } from "@/lib/types";

const ROUND_SIZE = 5;
const FEEDBACK_MS = 900;
/** 3択なので勘で当たる確率は1/3 */
const HEADLINE_CHANCE = 1 / 3;

interface Question {
  item: HeadlineItem;
  /** 表示順に並べた選択肢 */
  choices: string[];
  /** choices の中の正解位置 */
  answer: number;
}

type Phase = "ready" | "playing" | "done";

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
  const [best, setBest] = useState(0);
  const shownAt = useRef(0);

  function start() {
    setRound(buildRound());
    setIndex(0);
    setLogs([]);
    setReview([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPicked(null);
    shownAt.current = performance.now();
    setPhase("playing");
  }

  function choose(i: number) {
    if (picked !== null) return;
    const q = round[index];
    const ms = performance.now() - shownAt.current;
    const chars = countChars(q.item.text);
    const correct = i === q.answer;
    const nextLogs = [...logs, { id: q.item.id, correct, chars, ms }];
    const nextCombo = correct ? combo + 1 : 0;
    const nextScore = correct ? score + headlinePoints(chars, ms, combo) : score;
    const nextMax = Math.max(maxCombo, nextCombo);

    setPicked(i);
    setLogs(nextLogs);
    setScore(nextScore);
    setCombo(nextCombo);
    setMaxCombo(nextMax);
    if (!correct) {
      setReview((r) => [
        ...r,
        { id: q.item.id, text: q.item.text, yours: q.choices[i], correct: q.choices[q.answer], note: q.item.note },
      ]);
    }

    setTimeout(() => {
      setPicked(null);
      if (index + 1 >= round.length) {
        const prevBest = bestScore(loadHistory(), "headline");
        saveResult({
          mode: "headline",
          score: nextScore,
          correct: nextLogs.filter((l) => l.correct).length,
          total: nextLogs.length,
          effectiveCpm: effectiveCpm(nextLogs, HEADLINE_CHANCE),
          maxCombo: nextMax,
          at: new Date().toISOString(),
        });
        setBest(Math.max(prevBest, nextScore));
        setPhase("done");
      } else {
        setIndex(index + 1);
        shownAt.current = performance.now();
      }
    }, FEEDBACK_MS);
  }

  if (phase === "ready") {
    return (
      <div className="space-y-6">
        <Link href="/" className="muted text-sm">
          ← ホーム
        </Link>
        <h1 className="text-2xl font-black">見出しセレクト</h1>
        <div className="card space-y-3 p-5 text-sm leading-relaxed">
          <p>300字ほどの文章を読んで、内容にいちばん合う見出しを3つから選ぼう。全{ROUND_SIZE}問。</p>
          <p className="muted">正解すると基本100点。速く読めた分だけボーナス（最大100点）が付きます。</p>
          <p className="muted">ひっかけの見出しは、本文の一部だけを切り取ったり、逆のことを言ったりしています。</p>
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
        modeName="見出しセレクト"
        score={score}
        cpm={effectiveCpm(logs, HEADLINE_CHANCE)}
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

  const q = round[index];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="muted">
          {index + 1} / {round.length}
        </span>
        <span className="tabular-nums font-bold">{score}点</span>
      </div>
      <div className="card p-5" key={q.item.id}>
        <p className="muted mb-2 text-xs">{q.item.genre}</p>
        <p className="leading-loose">{q.item.text}</p>
      </div>
      <p className="text-center text-sm font-bold">いちばん合う見出しは？</p>
      <div className="space-y-2">
        {q.choices.map((c, i) => {
          const state =
            picked === null ? "" : i === q.answer ? "good" : i === picked ? "bad" : "dim";
          return (
            <button
              key={c}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`card block w-full p-4 text-left font-bold transition ${
                state === "good" ? "pop" : state === "bad" ? "shake" : state === "dim" ? "opacity-50" : ""
              }`}
              style={{
                borderColor: state === "good" ? "var(--good)" : state === "bad" ? "var(--bad)" : undefined,
                borderWidth: state === "good" || state === "bad" ? 3 : undefined,
              }}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
