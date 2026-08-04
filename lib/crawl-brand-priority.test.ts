import assert from "node:assert/strict";
import test from "node:test";
import {
  crawlPriorityForProduct,
  isDailyCrawlBrand,
  productBrandCandidates,
} from "./crawl-brand-priority";

test("ランキング指定のLeafとF&Cを毎日巡回する", () => {
  assert.equal(isDailyCrawlBrand(["Leaf"]), true);
  assert.equal(isDailyCrawlBrand(["F&C"]), true);
});

test("人気順ページで取得した表記も毎日巡回する", () => {
  assert.equal(isDailyCrawlBrand(["フロントウィング"]), true);
  assert.equal(isDailyCrawlBrand(["シルキーズプラス WASABI"]), true);
  assert.equal(isDailyCrawlBrand(["Guiltｙ"]), true);
});

test("ランキング上で同人表記だったブランドは毎日集合へ入れない", () => {
  assert.equal(isDailyCrawlBrand(["07th Expansion"]), false);
  assert.equal(isDailyCrawlBrand(["NEKO WORKs"]), false);
  assert.equal(isDailyCrawlBrand(["上海アリス幻樂団"]), false);
});

test("解散などの注記と括弧内の別名を除いて照合する", () => {
  assert.equal(isDailyCrawlBrand(["戯画"]), true);
  assert.equal(isDailyCrawlBrand(["HOOK"]), true);
  assert.equal(isDailyCrawlBrand(["ruf"]), true);
  assert.equal(isDailyCrawlBrand(["セガゲームス"]), true);
});

test("メーカー列と詳細JSONのブランド欄から候補を取得する", () => {
  const detailsJson = JSON.stringify({ ブランド: "Leaf", 原画: "人物名" });
  assert.deepEqual(productBrandCandidates("アクアプラス", detailsJson), [
    "アクアプラス",
    "Leaf",
  ]);
  assert.equal(crawlPriorityForProduct(null, detailsJson), "daily");
  assert.equal(crawlPriorityForProduct("未登録ブランド", null), "rotation");
});
