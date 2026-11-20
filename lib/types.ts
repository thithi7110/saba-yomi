export type Side = "left" | "right";

/** 仕分けラッシュのお題（左右どちらにスワイプするかの意味） */
export interface SortTopic {
  id: string;
  question: string;
  left: string;
  right: string;
  /** 判断のしかたの一言ヒント */
  hint: string;
}

/** 仕分けラッシュの1枚のカード */
export interface SortCard {
  id: string;
  topic: string;
  text: string;
  answer: Side;
  /** 解説（なぜその答えか） */
  note: string;
}

/** 見出しセレクトの1問。choices[answer] が正解（表示時にシャッフルする） */
export interface HeadlineItem {
  id: string;
  genre: string;
  text: string;
  choices: string[];
  answer: number;
  note: string;
}

export type ModeId = "rush" | "headline";

/** 1問ぶんの回答記録 */
export interface AnswerLog {
  id: string;
  correct: boolean;
  chars: number;
  ms: number;
}

export interface PlayResult {
  mode: ModeId;
  score: number;
  correct: number;
  total: number;
  /** 実効読速（字/分） */
  effectiveCpm: number;
  maxCombo: number;
  at: string;
}
