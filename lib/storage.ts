import type { ModeId, PlayResult } from "./types";

const KEY = "sabayomi:v1:history";
const MAX = 200;

export function loadHistory(): PlayResult[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlayResult[]) : [];
  } catch {
    return [];
  }
}

export function saveResult(result: PlayResult): void {
  try {
    const next = [...loadHistory(), result].slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できない環境（プライベートモード等）では記録しないだけ
  }
}

export function bestScore(history: PlayResult[], mode: ModeId): number {
  return history.filter((h) => h.mode === mode).reduce((m, h) => Math.max(m, h.score), 0);
}

export function bestCpm(history: PlayResult[]): number {
  return history.reduce((m, h) => Math.max(m, h.effectiveCpm), 0);
}
