import type { AnswerLog } from "./types";

/** コンボ倍率：連続正解ごとに +0.1、最大 2.0 倍 */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(combo, 0), 10) * 0.1;
}

/** この速さ（字/分）で読めたらスピード倍率1.0 */
export const TARGET_CPM = 500;

/** 読む速さの倍率：目標の速さで1.0、速いほど上がり最大1.5、遅いと最小0.5 */
export function speedMultiplier(chars: number, ms: number): number {
  if (ms <= 0) return 1.5;
  const ratio = charsPerMinute(chars, ms) / TARGET_CPM;
  return Math.min(1.5, Math.max(0.5, ratio));
}

/**
 * 仕分けラッシュ1問の得点。
 * 基本点（長い文ほど高い）× 読む速さ × むずかしさ × コンボ。
 */
export function rushPoints(chars: number, combo: number, ms: number, level: 1 | 2 = 1): number {
  const base = 10 + Math.floor(chars / 10);
  const levelMult = level === 2 ? 1.5 : 1;
  return Math.round(base * speedMultiplier(chars, ms) * levelMult * comboMultiplier(combo));
}

/**
 * 見出しセレクト1問の得点。
 * 基本100点 + 速さボーナス（最大100点）。速さは字/分で測り、1200字/分で満点。
 */
export function headlinePoints(chars: number, ms: number, combo: number): number {
  const cpm = charsPerMinute(chars, ms);
  const speedBonus = Math.min(100, Math.round((cpm / 1200) * 100));
  return Math.round((100 + speedBonus) * comboMultiplier(combo));
}

export function charsPerMinute(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  return (chars / ms) * 60_000;
}

/** これより速い読みは「読んでいない」とみなして頭打ちにする（字/分） */
export const MAX_COUNTED_CPM = 3000;

/**
 * 当てずっぽうを差し引いた正確さ（0〜1）。
 * 正答率から偶然当たる分（chance）を除き、2乗して「ほぼ全問正解」を強く評価する。
 * 例: 2択で正答率50% → 0、75% → 0.25、95% → 0.81
 */
export function judgedAccuracy(correct: number, total: number, chance: number): number {
  if (total === 0) return 0;
  const corrected = (correct / total - chance) / (1 - chance);
  return Math.max(0, corrected) ** 2;
}

/**
 * 実効読速（字/分）= 読む速さ × 当てずっぽうを差し引いた正確さ。
 * 速く適当に答えても、遅く正確でも伸びない。成長の主指標。
 * chance は1問を勘で当てる確率（2択なら0.5、3択なら1/3）。
 */
export function effectiveCpm(logs: AnswerLog[], chance: number): number {
  if (logs.length === 0) return 0;
  const chars = logs.reduce((s, l) => s + l.chars, 0);
  const ms = logs.reduce((s, l) => s + l.ms, 0);
  const speed = Math.min(charsPerMinute(chars, ms), MAX_COUNTED_CPM);
  const correct = logs.filter((l) => l.correct).length;
  return Math.round(speed * judgedAccuracy(correct, logs.length, chance));
}

export interface Rank {
  min: number;
  name: string;
  emoji: string;
}

export const RANKS: Rank[] = [
  { min: 0, name: "見習い", emoji: "🐟" },
  { min: 250, name: "読み手", emoji: "🐠" },
  { min: 450, name: "速読家", emoji: "🐡" },
  { min: 700, name: "情報さばき師", emoji: "🔪" },
  { min: 1000, name: "サバ読みマスター", emoji: "👑" },
];

export function rankFor(cpm: number): Rank {
  let r = RANKS[0];
  for (const rank of RANKS) if (cpm >= rank.min) r = rank;
  return r;
}

/** 配列をシャッフルした新しい配列を返す（Fisher–Yates） */
export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shareText(opts: {
  modeName: string;
  score: number;
  cpm: number;
  logs: AnswerLog[];
}): string {
  const grid = opts.logs.map((l) => (l.correct ? "🟩" : "🟥")).join("");
  const rank = rankFor(opts.cpm);
  return [
    `サバヨミ｜${opts.modeName}`,
    `${opts.score}点 / 実効読速 ${opts.cpm}字/分 ${rank.emoji}${rank.name}`,
    grid,
  ].join("\n");
}
