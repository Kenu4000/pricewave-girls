import assert from "node:assert/strict";
import test from "node:test";
import {
  CRAWL_ROTATION_DAYS,
  crawlRotationBucket,
  productCrawlRotationBucket,
} from "./crawl-schedule";

test("商品IDを3群へ安定して分割する", () => {
  assert.equal(CRAWL_ROTATION_DAYS, 3);
  assert.equal(productCrawlRotationBucket(1), 1);
  assert.equal(productCrawlRotationBucket(2), 2);
  assert.equal(productCrawlRotationBucket(3), 0);
  assert.equal(productCrawlRotationBucket(10), 1);
});

test("日付が1日進むごとにローテーション群も1つ進む", () => {
  const first = crawlRotationBucket(new Date(2026, 7, 5));
  const second = crawlRotationBucket(new Date(2026, 7, 6));
  const third = crawlRotationBucket(new Date(2026, 7, 7));

  assert.equal(second, (first + 1) % 3);
  assert.equal(third, (second + 1) % 3);
});
