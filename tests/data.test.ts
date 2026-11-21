import { describe, expect, it } from "vitest";
import { countChars, HEADLINE_ITEMS, SORT_CARDS, SORT_TOPICS } from "@/lib/questions";

describe("問題データ", () => {
  it("IDが重複していない", () => {
    const ids = [...SORT_CARDS.map((c) => c.id), ...HEADLINE_ITEMS.map((h) => h.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("仕分けカードは既知のお題・正しい答え・解説を持つ", () => {
    const topicIds = new Set(SORT_TOPICS.map((t) => t.id));
    for (const c of SORT_CARDS) {
      expect(topicIds.has(c.topic), c.id).toBe(true);
      expect(["left", "right"], c.id).toContain(c.answer);
      expect(c.note.length, c.id).toBeGreaterThan(0);
      expect([1, 2], c.id).toContain(c.level);
      const n = countChars(c.text);
      expect(n, c.id).toBeGreaterThanOrEqual(20);
      expect(n, c.id).toBeLessThanOrEqual(150);
    }
  });

  it("各お題で左右の答えが偏りすぎていない", () => {
    for (const t of SORT_TOPICS) {
      const cards = SORT_CARDS.filter((c) => c.topic === t.id);
      const left = cards.filter((c) => c.answer === "left").length;
      expect(cards.length, t.id).toBeGreaterThan(0);
      expect(left / cards.length, t.id).toBeGreaterThanOrEqual(0.3);
      expect(left / cards.length, t.id).toBeLessThanOrEqual(0.7);
    }
  });

  it("各お題に、ふつう・むずかしいの両方のカードがある", () => {
    for (const t of SORT_TOPICS) {
      const cards = SORT_CARDS.filter((c) => c.topic === t.id);
      expect(cards.filter((c) => c.level === 1).length, t.id).toBeGreaterThanOrEqual(8);
      expect(cards.filter((c) => c.level === 2).length, t.id).toBeGreaterThanOrEqual(8);
    }
  });

  it("見出し問題は3択で、正解の位置が範囲内", () => {
    for (const h of HEADLINE_ITEMS) {
      expect(h.choices.length, h.id).toBe(3);
      expect(new Set(h.choices).size, h.id).toBe(3);
      expect(h.answer, h.id).toBeGreaterThanOrEqual(0);
      expect(h.answer, h.id).toBeLessThan(h.choices.length);
      expect(countChars(h.text), h.id).toBeGreaterThanOrEqual(120);
    }
  });
});
