/**
 * 効果音。音声ファイルを使わず Web Audio で合成する（オフラインでも鳴り、容量もゼロ）。
 * ブラウザの制約で、最初のタップ（スタートボタン等）の後でないと鳴らない。
 */

const MUTE_KEY = "sabayomi:v1:muted";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (isMuted()) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 最初のユーザー操作で呼び、以降の効果音を鳴らせるようにする */
export function unlockAudio(): void {
  audio();
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // 保存できなくても、このセッション中の操作には影響しない
  }
}

interface Note {
  freq: number;
  /** 開始までの秒数 */
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** 終わりに向けて周波数をこの値へ滑らせる */
  slideTo?: number;
}

function play(notes: Note[]): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.01;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + n.at + n.dur);
    const peak = n.gain ?? 0.18;
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.02);
  }
}

/** 正解：コンボが続くほど音が高くなる2音のチャイム */
export function playCorrect(combo: number): void {
  const step = Math.min(combo, 8);
  const base = 660 * Math.pow(2, step / 12);
  play([
    { freq: base, at: 0, dur: 0.09, type: "triangle" },
    { freq: base * 1.5, at: 0.07, dur: 0.16, type: "triangle" },
  ]);
}

/** 不正解：低く下がるブザー */
export function playWrong(): void {
  play([{ freq: 220, at: 0, dur: 0.28, type: "square", gain: 0.08, slideTo: 140 }]);
}

/** カウントダウン（last=true で「スタート」の高い音） */
export function playTick(last = false): void {
  play([{ freq: last ? 1046 : 523, at: 0, dur: last ? 0.22 : 0.1, type: "sine", gain: 0.2 }]);
}

/** 残り時間の警告 */
export function playWarn(): void {
  play([{ freq: 880, at: 0, dur: 0.05, type: "square", gain: 0.05 }]);
}

/** 終了ファンファーレ */
export function playFinish(): void {
  play([
    { freq: 523, at: 0, dur: 0.12, type: "triangle" },
    { freq: 659, at: 0.12, dur: 0.12, type: "triangle" },
    { freq: 784, at: 0.24, dur: 0.12, type: "triangle" },
    { freq: 1046, at: 0.36, dur: 0.35, type: "triangle" },
  ]);
}

/** 振動（対応端末のみ。iPhone の Safari は非対応） */
export function buzz(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // 非対応環境では何もしない
  }
}
