import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ヘッダーのリクエスト右に周期振り分け画面への導線を置く", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const requestIndex = layout.indexOf('href="/requests"');
  const reviewIndex = layout.indexOf('href="/crawl-review"');

  assert.ok(requestIndex >= 0);
  assert.ok(reviewIndex > requestIndex);
  assert.match(layout, /周期振り分け/u);
});

test("周期振り分けは1日設定の商品だけを最初に読み込む", async () => {
  const page = await readFile(new URL("../app/crawl-review/page.tsx", import.meta.url), "utf8");

  assert.match(page, /where: \{ crawlIntervalDays: 1 \}/u);
  assert.match(page, /CrawlIntervalReview/u);
});

test("商品を1件ずつ1・3・7・14・無へ振り分ける", async () => {
  const review = await readFile(
    new URL("../components/CrawlIntervalReview.tsx", import.meta.url),
    "utf8",
  );

  assert.match(review, /1日のまま/u);
  assert.match(review, /label: "3日"/u);
  assert.match(review, /label: "7日"/u);
  assert.match(review, /label: "14日"/u);
  assert.match(review, /label: "無"/u);
  assert.match(review, /initialProducts\[index\]/u);
  assert.match(review, /setIndex\(\(value\) => value \+ 1\)/u);
  assert.match(review, /\/api\/products\/\$\{current\.id\}\/crawl-interval/u);
  assert.match(review, /option\.value !== 1/u);
  assert.match(review, /商品詳細を別タブで開く/u);
});
