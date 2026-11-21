"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown, type Feedback, FeedbackOverlay, GameTopBar, SoundToggle } from "@/components/GameUI";
import { ResultView, type ReviewItem } from "@/components/ResultView";
import { countChars, SORT_CARDS, SORT_TOPICS, topicById } from "@/lib/questions";
import { effectiveCpm, rushPoints, shuffle, speedMultiplier } from "@/lib/score";
import { buzz, playCorrect, playFinish, playWarn, playWrong, unlockAudio } from "@/lib/sound";
import { bestScore, loadHistory, saveResult } from "@/lib/storage";
import type { AnswerLog, Side, SortCard } from "@/lib/types";

const DURATION_MS = 40_000;
const SWIPE_THRESHOLD = 80;
/** 2択なので勘で当たる確率は1/2 */
const RUSH_CHANCE = 1 / 2;
/** 正誤の表示時間（この間は残り時間が減らない） */
const CORRECT_SHOW_MS = 450;
const WRONG_SHOW_MS = 1800;
const WARN_FROM_MS = 10_000;
/** まちがえると残り時間がこれだけ減る */
const MISS_PENALTY_MS = 3_000;
/** 最初はふつうのカードを何枚か出して慣らす */
const WARMUP_CARDS = 3;

/** ふつうのカードを数枚出してから、残りとむずかしいカードを混ぜて出す */
function buildDeck(topicId: string): SortCard[] {
  const cards = SORT_CARDS.filter((c) => c.topic === topicId);
  const easy = shuffle(cards.filter((c) => c.level === 1));
  const hard = cards.filter((c) => c.level === 2);
  return [...easy.slice(0, WARMUP_CARDS), ...shuffle([...easy.slice(WARMUP_CARDS), ...hard])];
}

type Phase = "ready" | "countdown" | "playing" | "done";

export default function RushPage() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [topicId, setTopicId] = useState(SORT_TOPICS[0].id);
  const [deck, setDeck] = useState<SortCard[]>([]);
  const [index, setIndex] = useState(0);
  const [logs, setLogs] = useState<AnswerLog[]>([]);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [remaining, setRemaining] = useState(DURATION_MS);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [dragX, setDragX] = useState(0);
  const [best, setBest] = useState(0);

  /** 回答中（正誤表示を除く）の経過時間 */
  const elapsed = useRef(0);
  const lastTick = useRef(0);
  const shownAt = useRef(0);
  const dragStart = useRef<number | null>(null);
  const finished = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWarnSec = useRef<number | null>(null);

  const stateRef = useRef({ logs, score, maxCombo, feedback, index, deck });
  stateRef.current = { logs, score, maxCombo, feedback, index, deck };

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    const { logs: finalLogs, score: finalScore, maxCombo: finalMax } = stateRef.current;
    const prevBest = bestScore(loadHistory(), "rush");
    saveResult({
      mode: "rush",
      score: finalScore,
      correct: finalLogs.filter((l) => l.correct).length,
      total: finalLogs.length,
      effectiveCpm: effectiveCpm(finalLogs, RUSH_CHANCE),
      maxCombo: finalMax,
      at: new Date().toISOString(),
    });
    setBest(Math.max(prevBest, finalScore));
    setFeedback(null);
    playFinish();
    setPhase("done");
  }, []);

  function begin(id: string = topicId) {
    unlockAudio();
    finished.current = false;
    setTopicId(id);
    setDeck(buildDeck(id));
    setIndex(0);
    setLogs([]);
    setReview([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setRemaining(DURATION_MS);
    setDragX(0);
    setFeedback(null);
    lastWarnSec.current = null;
    setPhase("countdown");
  }

  const startPlaying = useCallback(() => {
    elapsed.current = 0;
    lastTick.current = performance.now();
    shownAt.current = performance.now();
    setPhase("playing");
  }, []);

  // 残り時間のタイマー（正誤表示中は止める）
  useEffect(() => {
    if (phase !== "playing") return;
    lastTick.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      if (!stateRef.current.feedback) elapsed.current += now - lastTick.current;
      lastTick.current = now;
      const left = Math.max(0, DURATION_MS - elapsed.current);
      setRemaining(left);
      const sec = Math.ceil(left / 1000);
      if (left <= WARN_FROM_MS && left > 0 && sec !== lastWarnSec.current) {
        lastWarnSec.current = sec;
        playWarn();
      }
      if (left <= 0) finish();
    }, 100);
    return () => clearInterval(id);
  }, [phase, finish]);

  const next = useCallback(() => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
    setFeedback(null);
    setDragX(0);
    const { index: i, deck: d } = stateRef.current;
    if (i + 1 >= d.length) {
      finish();
    } else {
      setIndex(i + 1);
      shownAt.current = performance.now();
    }
  }, [finish]);

  const answer = useCallback(
    (side: Side) => {
      if (phase !== "playing" || finished.current || feedback) return;
      const card = deck[index];
      if (!card) return;
      const correct = card.answer === side;
      const log: AnswerLog = {
        id: card.id,
        correct,
        chars: countChars(card.text),
        ms: performance.now() - shownAt.current,
      };
      const topic = topicById(card.topic);
      const points = correct ? rushPoints(log.chars, combo, log.ms, card.level) : 0;
      const fast = speedMultiplier(log.chars, log.ms) >= 1.2;
      const nextCombo = correct ? combo + 1 : 0;

      setLogs((l) => [...l, log]);
      setCombo(nextCombo);
      setScore((s) => s + points);
      setMaxCombo((m) => Math.max(m, nextCombo));
      setDragX(side === "left" ? -400 : 400);

      if (correct) {
        playCorrect(nextCombo);
        setFeedback({ correct: true, points, combo: nextCombo, fast, hard: card.level === 2 });
      } else {
        playWrong();
        buzz(120);
        setReview((r) => [
          ...r,
          { id: card.id, text: card.text, yours: topic[side], correct: topic[card.answer], note: card.note },
        ]);
        elapsed.current += MISS_PENALTY_MS;
        setFeedback({ correct: false, answer: topic[card.answer], note: card.note, penaltySec: MISS_PENALTY_MS / 1000 });
      }
      feedbackTimer.current = setTimeout(next, correct ? CORRECT_SHOW_MS : WRONG_SHOW_MS);
    },
    [phase, feedback, deck, index, combo, next],
  );

  // キーボード（PC用）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") answer("left");
      if (e.key === "ArrowRight") answer("right");
      if ((e.key === "Enter" || e.key === " ") && stateRef.current.feedback) next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, next]);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  if (phase === "ready") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="muted">
            ← ホーム
          </Link>
          <SoundToggle />
        </div>
        <div>
          <h1 className="text-3xl font-black">仕分けラッシュ</h1>
          <p className="mt-2 text-lg">お題をえらぶと、すぐ始まります</p>
        </div>
        <div className="space-y-3">
          {SORT_TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => begin(t.id)}
              className="card block w-full space-y-3 p-5 text-left transition active:scale-[0.99]"
            >
              <p className="text-2xl font-black">{t.question}</p>
              <div className="space-y-1.5">
                {t.examples.map((ex) => (
                  <p key={ex.text} className="flex items-center gap-2 text-base">
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold text-white"
                      style={{ background: ex.side === "left" ? "var(--left)" : "var(--right)" }}
                    >
                      {ex.side === "left" ? `← ${t.left}` : `${t.right} →`}
                    </span>
                    <span className="min-w-0">{ex.text}</span>
                  </p>
                ))}
              </div>
            </button>
          ))}
        </div>
        <p className="muted text-center">40秒・速く正しく読むほど高得点・ミスは−3秒</p>
      </div>
    );
  }

  if (phase === "countdown") return <Countdown onDone={startPlaying} />;

  if (phase === "done") {
    return (
      <ResultView
        modeName={`仕分けラッシュ（${topicById(topicId).left}／${topicById(topicId).right}）`}
        score={score}
        cpm={effectiveCpm(logs, RUSH_CHANCE)}
        correct={logs.filter((l) => l.correct).length}
        total={logs.length}
        maxCombo={maxCombo}
        logs={logs}
        best={best}
        review={review}
        onRetry={() => begin()}
      />
    );
  }

  const card = deck[index];
  const topic = topicById(card.topic);
  const pct = (remaining / DURATION_MS) * 100;
  const hurry = remaining <= WARN_FROM_MS;
  const lean = dragX > 30 ? "right" : dragX < -30 ? "left" : null;

  return (
    <div className="flex min-h-[88dvh] select-none flex-col gap-3">
      <GameTopBar />

      <div className="grid grid-cols-3 items-end">
        <div>
          <p className="muted text-xs">スコア</p>
          <p className="text-2xl font-black tabular-nums">{score}</p>
        </div>
        <div className="text-center">
          {combo >= 2 && (
            <p key={combo} className="pop text-lg font-black text-[var(--accent)]">
              {combo}コンボ🔥
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="muted text-xs">残り</p>
          <p className={`text-2xl font-black tabular-nums ${hurry ? "text-[var(--bad)]" : ""}`}>
            {Math.ceil(remaining / 1000)}
            <span className="text-sm font-normal">秒</span>
          </p>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full transition-[width] duration-100"
          style={{ width: `${pct}%`, background: hurry ? "var(--bad)" : "var(--accent)" }}
        />
      </div>

      <div className="mt-1 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-center">
        <p className="text-xl font-black">{topic.question}</p>
        <p className="muted mt-1 text-sm leading-relaxed">{topic.hint}</p>
      </div>

      <div
        key={card.id}
        className="card pop relative flex flex-1 touch-none items-center px-6 py-10"
        style={{
          transform: `translateX(${dragX}px) rotate(${dragX / 25}deg)`,
          transition: dragStart.current === null ? "transform 0.18s ease-out, opacity 0.18s" : "none",
          opacity: feedback ? 0 : 1,
          borderColor: lean === "left" ? "var(--left)" : lean === "right" ? "var(--right)" : undefined,
          borderWidth: lean ? 3 : undefined,
        }}
        onPointerDown={(e) => {
          if (feedback) return;
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
        {lean && (
          <span
            className="absolute top-3 rounded-full px-3 py-1 text-sm font-black text-white"
            style={{
              background: lean === "left" ? "var(--left)" : "var(--right)",
              left: lean === "left" ? 12 : undefined,
              right: lean === "right" ? 12 : undefined,
            }}
          >
            {lean === "left" ? `← ${topic.left}` : `${topic.right} →`}
          </span>
        )}
        {card.level === 2 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-[var(--bad-tint)] px-2.5 py-0.5 text-xs font-bold text-[var(--bad)]">
            むずかしい ×1.5
          </span>
        )}
        <p className="text-xl leading-loose">{card.text}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 pb-2">
        <button
          className="btn py-5 text-xl text-white"
          style={{ background: "var(--left)", opacity: lean === "right" ? 0.5 : 1 }}
          onClick={() => answer("left")}
        >
          ← {topic.left}
        </button>
        <button
          className="btn py-5 text-xl text-white"
          style={{ background: "var(--right)", opacity: lean === "left" ? 0.5 : 1 }}
          onClick={() => answer("right")}
        >
          {topic.right} →
        </button>
      </div>

      {feedback && <FeedbackOverlay fb={feedback} onSkip={next} />}
    </div>
  );
}
