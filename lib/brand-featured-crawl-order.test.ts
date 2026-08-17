import assert from "node:assert/strict";
import test from "node:test";
import { rankFeaturedBrandsByCrawlFrequency } from "./brand-featured-crawl-order";

test("メーカー候補は1日率から順に短い巡回周期の割合を優先する", () => {
  const products = [
    ...Array.from({ length: 10 }, (_, index) => ({
      manufacturer: "A",
      crawlIntervalDays: index < 6 ? 1 : null,
    })),
    ...Array.from({ length: 20 }, (_, index) => ({
      manufacturer: "B",
      crawlIntervalDays: index < 8 ? 1 : index < 16 ? 3 : null,
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      manufacturer: "C",
      crawlIntervalDays: index < 6 ? 1 : index < 9 ? 3 : null,
    })),
  ];

  const ranked = rankFeaturedBrandsByCrawlFrequency(products);
  assert.deepEqual(ranked.slice(0, 3).map((profile) => profile.label), ["C", "A", "B"]);
});

test("ブランド別名を統合して巡回周期比率を計算する", () => {
  const ranked = rankFeaturedBrandsByCrawlFrequency([
    { manufacturer: "ALICESOFT", crawlIntervalDays: 1 },
    { manufacturer: "アリスソフト", crawlIntervalDays: 3 },
    { manufacturer: "Leaf", crawlIntervalDays: 14 },
    { manufacturer: "Leaf", crawlIntervalDays: 14 },
  ]);

  assert.equal(ranked[0].label, "ALICESOFT（アリスソフト）");
  assert.equal(ranked[0].total, 2);
  assert.equal(ranked[0].daily, 1);
  assert.equal(ranked[0].withinThreeDays, 2);
});

test("同率なら登録数が多いメーカーを先にする", () => {
  const ranked = rankFeaturedBrandsByCrawlFrequency([
    { manufacturer: "A", crawlIntervalDays: 7 },
    { manufacturer: "A", crawlIntervalDays: 14 },
    { manufacturer: "B", crawlIntervalDays: 7 },
    { manufacturer: "B", crawlIntervalDays: 14 },
    { manufacturer: "B", crawlIntervalDays: null },
  ]);

  assert.deepEqual(ranked.map((profile) => profile.label), ["A", "B"]);
});
