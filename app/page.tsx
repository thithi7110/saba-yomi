"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RANKS, rankFor } from "@/lib/score";
import { bestCpm, bestScore, loadHistory } from "@/lib/storage";
import type { PlayResult } from "@/lib/types";

const MODES = [
  {
    href: "/rush/",
    id: "rush" as const,
    name: "仕分けラッシュ",
    time: "60秒",
    desc: "短い文が次々に流れてくる。読んだらすぐ左右にスワイプして判断。事実か意見か、今日やるべきか、宣伝か、筋が通っているか。",
  },
  {
    href: "/headline/",
    id: "headline" as const,
    name: "見出しセレクト",
    time: "5問",
    desc: "300字ほどの文章を読んで、いちばん合う見出しを3つから選ぶ。速く、正しく要点をつかもう。",
  },
];

export default function Home() {
  const [history, setHistory] = useState<PlayResult[]>([]);
  useEffect(() => setHistory(loadHistory()), []);
  const cpm = bestCpm(history);
  const rank = rankFor(cpm);

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight">
          サバ<span className="text-[var(--accent)]">ヨミ</span>
        </h1>
        <p className="muted mt-2 text-sm">文章をサッと読んで、パッと判断。</p>
      </header>

      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="muted text-xs">ベスト実効読速</p>
          <p className="text-2xl font-black tabular-nums">
            {cpm}
            <span className="muted ml-1 text-sm font-normal">字/分</span>
          </p>
        </div>
        <p className="text-right text-lg font-bold">
          {rank.emoji} {rank.name}
        </p>
      </div>

      <div className="space-y-3">
        {MODES.map((m) => (
          <Link key={m.id} href={m.href} className="card block p-5 transition active:scale-[0.99]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold">{m.name}</h2>
              <span className="muted text-xs">{m.time}</span>
            </div>
            <p className="muted mt-2 text-sm leading-relaxed">{m.desc}</p>
            <p className="mt-3 text-sm">
              ベスト <span className="font-bold tabular-nums">{bestScore(history, m.id)}</span> 点
            </p>
          </Link>
        ))}
      </div>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-bold">スコアと「実効読速」について</summary>
        <div className="muted mt-3 space-y-2 leading-relaxed">
          <p>
            実効読速 = 読む速さ（字/分）× 判断の正確さ。正確さは「勘で当たる分」を差し引いて計算するので、適当に連打しても伸びません。ゆっくり正確でも伸びません。速く読めて、しかも判断が合っているほど上がります。
          </p>
          <ul className="space-y-1">
            {RANKS.map((r) => (
              <li key={r.name}>
                {r.emoji} {r.name}：{r.min}字/分〜
              </li>
            ))}
          </ul>
          <p>文章はすべて練習用に作った架空のものです。記録はこの端末の中だけに保存されます。</p>
        </div>
      </details>
    </div>
  );
}
