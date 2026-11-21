/**
 * 問題の自動生成スクリプト（Claude API を使用）
 *
 * 使い方:
 *   ANTHROPIC_API_KEY=... npm run generate -- sort fact 10
 *   ANTHROPIC_API_KEY=... npm run generate -- headline 社内メール 5
 *
 * 流れ:
 *   1. 生成: 問題・正解・解説を構造化JSONで作らせる
 *   2. 検証: 正解を隠した状態で別の呼び出しに解かせ、正解が一致した問題だけ残す
 *   3. data/generated/ に書き出す。人が目を通してから data/*.json に移す
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sortData from "../data/sort.json";

const MODEL = "claude-opus-5-5";
const client = new Anthropic();

const COMMON_RULES = `
- すべて日本語。実在の人物・企業・団体・事件は使わず、架空の内容にする。
- 社会人が日常や仕事で出会う文章（メール、チャット、ニュース風、レビュー、規約、ブログ、AIの回答など）を題材にする。
- 正解が一つに定まり、読めば根拠を示せる問題にする。読み手の価値観で答えが割れる問題は作らない。
`;

const SortBatch = z.object({
  cards: z.array(
    z.object({
      text: z.string().describe("40〜140字の短い文"),
      answer: z.enum(["left", "right"]),
      note: z.string().describe("なぜその答えか、40字以内の解説"),
    }),
  ),
});

const HeadlineBatch = z.object({
  items: z.array(
    z.object({
      text: z.string().describe("220〜400字の文章"),
      correct: z.string().describe("内容に最も合う見出し（30字以内）"),
      distractors: z
        .array(z.string())
        .describe("ひっかけ見出し2つ。本文の一部だけを切り取る、逆のことを言う、などもっともらしいが誤り"),
      note: z.string().describe("なぜ正解か、50字以内の解説"),
    }),
  ),
});

const Verdict = z.object({ answer: z.string() });

async function parse<T extends z.ZodType>(schema: T, prompt: string, effort: "low" | "medium" | "high") {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(schema), effort },
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal") {
    console.warn("生成を断られたためスキップしました");
    return null;
  }
  return res.parsed_output as z.infer<T> | null;
}

async function generateSort(topicId: string, count: number) {
  const topic = sortData.topics.find((t) => t.id === topicId);
  if (!topic) throw new Error(`お題が見つかりません: ${topicId}（${sortData.topics.map((t) => t.id).join(", ")}）`);

  const batch = await parse(
    SortBatch,
    `読解ゲームの問題を${count}問作ってください。
お題:「${topic.question}」 left=「${topic.left}」 right=「${topic.right}」
${COMMON_RULES}
- left と right がおおよそ半々になるようにする。
- 既存の例: ${sortData.cards
      .filter((c) => c.topic === topicId)
      .slice(0, 3)
      .map((c) => `「${c.text}」→${c.answer}`)
      .join(" / ")}
- 既存の例と似た内容は避ける。`,
    "high",
  );
  if (!batch) return [];

  const kept = [];
  for (const card of batch.cards) {
    const v = await parse(
      Verdict,
      `次の文について「${topic.question}」に答えてください。answer には「${topic.left}」か「${topic.right}」のどちらかだけを入れてください。

文: ${card.text}`,
      "low",
    );
    const solved = v?.answer.trim() === topic.left ? "left" : v?.answer.trim() === topic.right ? "right" : null;
    if (solved === card.answer) kept.push({ topic: topicId, level: 1, ...card });
    else console.warn(`検証で不一致のため除外: ${card.text}`);
  }
  return kept;
}

async function generateHeadline(genre: string, count: number) {
  const batch = await parse(
    HeadlineBatch,
    `読解ゲーム「見出しセレクト」の問題を${count}問作ってください。ジャンル: ${genre}
${COMMON_RULES}
- 見出しは本文の要点（結論）を表すこと。`,
    "high",
  );
  if (!batch) return [];

  const kept = [];
  for (const item of batch.items) {
    if (item.distractors.length !== 2) continue;
    const choices = [item.correct, ...item.distractors].sort(() => Math.random() - 0.5);
    const v = await parse(
      Verdict,
      `次の文章に最も合う見出しを選択肢から1つ選び、answer にその見出しの文字列をそのまま入れてください。

文章: ${item.text}

選択肢:
${choices.map((c) => `- ${c}`).join("\n")}`,
      "low",
    );
    if (v?.answer.trim() === item.correct) {
      kept.push({ genre, text: item.text, choices: [item.correct, ...item.distractors], answer: 0, note: item.note });
    } else {
      console.warn(`検証で不一致のため除外: ${item.correct}`);
    }
  }
  return kept;
}

async function main() {
  const [kind, target, countArg] = process.argv.slice(2);
  const count = Number(countArg ?? 5);
  if (!kind || !target || !Number.isFinite(count)) {
    console.error("使い方: npm run generate -- sort <topicId> <count> | headline <genre> <count>");
    process.exit(1);
  }
  const result = kind === "sort" ? await generateSort(target, count) : await generateHeadline(target, count);

  const dir = path.join(process.cwd(), "data", "generated");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${kind}-${target}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
  console.log(`${result.length}問を書き出しました: ${file}`);
  console.log("内容を確認し、IDを付けて data/sort.json か data/headline.json に追加してください。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
