import assert from "node:assert/strict";
import test from "node:test";
import {
  crawlPriorityForProduct,
  isDailyCrawlBrand,
  isDailyCrawlProductTitle,
  productBrandCandidates,
} from "./crawl-brand-priority";

test("確定一覧のLeaf、F&C、NEXTONを毎日巡回する", () => {
  assert.equal(isDailyCrawlBrand(["Leaf"]), true);
  assert.equal(isDailyCrawlBrand(["F&C"]), true);
  assert.equal(isDailyCrawlBrand(["NEXTON"]), true);
});

test("表記揺れと別名を吸収する", () => {
  assert.equal(isDailyCrawlBrand(["フロントウィング"]), true);
  assert.equal(isDailyCrawlBrand(["シルキーズプラス WASABI"]), true);
  assert.equal(isDailyCrawlBrand(["HOOK"]), true);
  assert.equal(isDailyCrawlBrand(["ruf"]), true);
  assert.equal(isDailyCrawlBrand(["5pb."]), true);
});

test("確定一覧から外したブランドはブランド全体を毎日巡回しない", () => {
  assert.equal(isDailyCrawlBrand(["Acacia"]), false);
  assert.equal(isDailyCrawlBrand(["アパタイト"]), false);
  assert.equal(isDailyCrawlBrand(["KONAMI"]), false);
  assert.equal(isDailyCrawlBrand(["NEKO WORKs"]), false);
});

test("CROSS CHANNELはブランドではなく商品名として毎日巡回する", () => {
  assert.equal(isDailyCrawlBrand(["CROSS†CHANNEL"]), false);
  assert.equal(isDailyCrawlProductTitle("CROSS†CHANNEL -FINAL COMPLETE-"), true);
  assert.equal(isDailyCrawlProductTitle("CROSS CHANNEL 復刻版"), true);
  assert.equal(isDailyCrawlProductTitle("別の商品"), false);
});

test("メーカー列と詳細JSONのブランド欄から候補を取得する", () => {
  const detailsJson = JSON.stringify({ ブランド: "Leaf", 原画: "人物名" });
  assert.deepEqual(productBrandCandidates("アクアプラス", detailsJson), [
    "アクアプラス",
    "Leaf",
  ]);
  assert.equal(crawlPriorityForProduct("商品名", null, detailsJson), "daily");
  assert.equal(
    crawlPriorityForProduct("商品名", "未登録ブランド", null),
    "rotation",
  );
});
