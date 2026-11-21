import { describe, expect, it } from "vitest";
import { comboMultiplier, effectiveCpm, headlinePoints, judgedAccuracy, rankFor, rushPoints, shareText, shuffle, speedMultiplier } from "@/lib/score";

describe("score", () => {
  it("コンボ倍率は0.1刻みで最大2倍", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMultiplier(50)).toBe(2);
  });

  it("仕分けの得点は長さ・速さ・むずかしさ・コンボで決まる", () => {
    // 100字を12秒（500字/分）で読む → 速さ倍率1.0
    expect(rushPoints(100, 0, 12_000)).toBe(20);
    expect(rushPoints(100, 10, 12_000)).toBe(40);
    // 速く読むと最大1.5倍、遅いと0.5倍まで下がる
    expect(rushPoints(100, 0, 1_000)).toBe(30);
    expect(rushPoints(100, 0, 60_000)).toBe(10);
    // むずかしいカードは1.5倍
    expect(rushPoints(100, 0, 12_000, 2)).toBe(30);
  });

  it("速さ倍率は0.5〜1.5に収まる", () => {
    expect(speedMultiplier(100, 12_000)).toBeCloseTo(1);
    expect(speedMultiplier(100, 1)).toBe(1.5);
    expect(speedMultiplier(100, 600_000)).toBe(0.5);
  });

  it("見出しの速さボーナスは最大100点", () => {
    expect(headlinePoints(300, 60_000, 0)).toBe(125); // 300字/分 → ボーナス25
    expect(headlinePoints(300, 1_000, 0)).toBe(200); // 超高速でも上限
  });

  it("勘で当たる分を差し引いた正確さ", () => {
    expect(judgedAccuracy(5, 10, 0.5)).toBe(0);
    expect(judgedAccuracy(3, 10, 0.5)).toBe(0);
    expect(judgedAccuracy(10, 10, 0.5)).toBe(1);
    expect(judgedAccuracy(19, 20, 0.5)).toBeCloseTo(0.81);
  });

  it("実効読速は正確さで割り引かれる", () => {
    const log = (correct: boolean) => ({ id: "x", correct, chars: 100, ms: 10_000 });
    // 600字/分 で全問正解 → 600
    expect(effectiveCpm([log(true), log(true)], 0.5)).toBe(600);
    // 2択で半分正解は勘と同じ → 0
    expect(effectiveCpm([log(true), log(false)], 0.5)).toBe(0);
    expect(effectiveCpm([], 0.5)).toBe(0);
  });

  it("適当な連打では高ランクにならない", () => {
    // 1問0.2秒（非現実的な速さ）で正答率57%
    const logs = Array.from({ length: 21 }, (_, i) => ({ id: `${i}`, correct: i < 12, chars: 50, ms: 200 }));
    expect(rankFor(effectiveCpm(logs, 0.5)).name).toBe("見習い");
  });

  it("ランクは閾値で決まる", () => {
    expect(rankFor(0).name).toBe("見習い");
    expect(rankFor(699).name).toBe("速読家");
    expect(rankFor(5000).name).toBe("サバ読みマスター");
  });

  it("shuffleは要素を失わず、元の配列を変えない", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src);
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it("シェア文に結果のマスが並ぶ", () => {
    const text = shareText({
      modeName: "仕分けラッシュ",
      score: 120,
      cpm: 520,
      logs: [
        { id: "a", correct: true, chars: 1, ms: 1 },
        { id: "b", correct: false, chars: 1, ms: 1 },
      ],
    });
    expect(text).toContain("🟩🟥");
    expect(text).toContain("速読家");
  });
});
