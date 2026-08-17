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

test("周期振り分けは未確認の1日設定商品だけを読み込む", async () => {
  const page = await readFile(new URL("../app/crawl-review/page.tsx", import.meta.url), "utf8");

  assert.match(page, /crawlIntervalDays: 1/u);
  assert.match(page, /crawlIntervalReviewedAt: null/u);
  assert.match(page, /CrawlIntervalReview/u);
});

test("1日のまま判定は確認済みとして保存し今後の候補から外す", async () => {
  const review = await readFile(
    new URL("../components/CrawlIntervalReview.tsx", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/products/[id]/crawl-review/route.ts", import.meta.url),
    "utf8",
  );
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

  assert.match(review, /1日のまま/u);
  assert.match(review, /\/api\/products\/\$\{current\.id\}\/crawl-review/u);
  assert.match(route, /crawlIntervalDays: 1/u);
  assert.match(route, /crawlIntervalReviewedAt: new Date\(\)/u);
  assert.match(schema, /crawlIntervalReviewedAt\s+DateTime\?/u);
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
  assert.match(review, /商品詳細を別タブで開く/u);
});

test("周期を変更した商品は1日確認済み状態を解除する", async () => {
  const single = await readFile(
    new URL("../app/api/products/[id]/crawl-interval/route.ts", import.meta.url),
    "utf8",
  );
  const bulk = await readFile(
    new URL("../app/api/products/crawl-intervals/by-brand/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(single, /crawlIntervalReviewedAt: null/u);
  assert.match(bulk, /crawlIntervalReviewedAt: null/u);
});
