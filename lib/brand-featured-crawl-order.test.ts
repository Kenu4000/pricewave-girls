import assert from "node:assert/strict";
import test from "node:test";
import {
  rankFeaturedBrandsByCrawlFrequency,
  selectFeaturedBrands,
} from "./brand-featured-crawl-order";

test("メーカー候補は1日と3日を合わせた短い巡回周期の割合を最優先する", () => {
  const products = [
    ...Array.from({ length: 10 }, (_, index) => ({ manufacturer: "A", crawlIntervalDays: index < 6 ? 1 : null })),
    ...Array.from({ length: 20 }, (_, index) => ({ manufacturer: "B", crawlIntervalDays: index < 8 ? 1 : index < 16 ? 3 : null })),
    ...Array.from({ length: 10 }, (_, index) => ({ manufacturer: "C", crawlIntervalDays: index < 6 ? 1 : index < 9 ? 3 : null })),
  ];
  const ranked = rankFeaturedBrandsByCrawlFrequency(products);
  assert.deepEqual(ranked.slice(0, 3).map((profile) => profile.label), ["C", "B", "A"]);
});

test("3日周期中心のメーカーも1日周期中心のメーカーより上に入れる", () => {
  const ranked = rankFeaturedBrandsByCrawlFrequency([
    ...Array.from({ length: 10 }, (_, index) => ({ manufacturer: "ThreeDay", crawlIntervalDays: index < 9 ? 3 : null })),
    ...Array.from({ length: 10 }, (_, index) => ({ manufacturer: "Daily", crawlIntervalDays: index < 8 ? 1 : null })),
  ]);
  assert.deepEqual(ranked.slice(0, 2).map((profile) => profile.label), ["ThreeDay", "Daily"]);
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

test("よく登録されているメーカーは12件に制限しない", () => {
  const products = Array.from({ length: 15 }, (_, brandIndex) => [
    { manufacturer: `Brand${brandIndex}`, crawlIntervalDays: 3 },
    { manufacturer: `Brand${brandIndex}`, crawlIntervalDays: 3 },
  ]).flat();
  const ranked = rankFeaturedBrandsByCrawlFrequency(products);
  assert.equal(ranked.length, 15);
});

test("注目枠はBEEPとAiNOを除外し自動20件に指定5メーカーを追加する", () => {
  const products = [
    { manufacturer: "ＢＥＥＰ", crawlIntervalDays: 1 },
    { manufacturer: "ＢＥＥＰ", crawlIntervalDays: 1 },
    { manufacturer: "AiNO", crawlIntervalDays: 1 },
    { manufacturer: "AiNO", crawlIntervalDays: 1 },
    { manufacturer: "暁", crawlIntervalDays: null },
    { manufacturer: "あっぷりけ", crawlIntervalDays: null },
    { manufacturer: "パープルソフトウェア", crawlIntervalDays: null },
    { manufacturer: "Navel", crawlIntervalDays: null },
    { manufacturer: "パレット", crawlIntervalDays: null },
    ...Array.from({ length: 24 }, (_, index) => [
      { manufacturer: `Auto${index}`, crawlIntervalDays: 3 },
      { manufacturer: `Auto${index}`, crawlIntervalDays: 3 },
    ]).flat(),
  ];

  const selected = selectFeaturedBrands(products);
  const labels = selected.map((profile) => profile.label);
  assert.equal(selected.length, 25);
  assert.ok(labels.includes("暁"));
  assert.ok(labels.includes("あっぷりけ"));
  assert.ok(labels.includes("Purple software（パープルソフトウェア）"));
  assert.ok(labels.includes("Navel"));
  assert.ok(labels.includes("ぱれっと"));
  assert.ok(!labels.includes("ＢＥＥＰ"));
  assert.ok(!labels.includes("あかべぇそふとつぅ"));
});
