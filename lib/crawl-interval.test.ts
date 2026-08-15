import assert from "node:assert/strict";
import test from "node:test";
import { isCrawlDue, parseCrawlIntervalDays } from "./crawl-interval";

test("巡回周期は1・3・7・14日と無だけを受け付ける", () => {
  assert.equal(parseCrawlIntervalDays(1), 1);
  assert.equal(parseCrawlIntervalDays("3"), 3);
  assert.equal(parseCrawlIntervalDays(7), 7);
  assert.equal(parseCrawlIntervalDays(14), 14);
  assert.equal(parseCrawlIntervalDays(null), null);
  assert.equal(parseCrawlIntervalDays(2), undefined);
});

test("履歴がない商品は周期ありなら自動巡回対象になる", () => {
  assert.equal(isCrawlDue(1, null, new Date("2026-08-16T00:00:00Z")), true);
  assert.equal(isCrawlDue(null, null, new Date("2026-08-16T00:00:00Z")), false);
});

test("最新確認日時から設定日数を経過した商品だけ対象になる", () => {
  const now = new Date("2026-08-16T00:00:00Z");
  assert.equal(isCrawlDue(3, "2026-08-13T00:00:00Z", now), true);
  assert.equal(isCrawlDue(3, "2026-08-14T00:00:00Z", now), false);
  assert.equal(isCrawlDue(14, "2026-08-02T00:00:00Z", now), true);
});
