import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isReleaseDateTodayInJapan,
  japanDateKey,
  normalizeReleaseDateKey,
  RELEASE_CRAWL_AUTOMATION_START_DATE,
  releaseDayCrawlDecision,
  type ReleaseDayCrawlProduct,
} from "./release-day-crawl";

const now = new Date("2026-09-04T12:00:00.000Z"); // 2026-09-04 21:00 JST

function product(
  overrides: Partial<ReleaseDayCrawlProduct> = {},
): ReleaseDayCrawlProduct {
  return {
    id: 1,
    releaseDate: "2026/09/04",
    createdAt: "2026-09-03T12:00:00.000Z",
    crawlIntervalDays: 14,
    releaseCrawlPromotedForDate: null,
    ...overrides,
  };
}

test("発売日文字列を日付キーへ正規化する", () => {
  assert.equal(normalizeReleaseDateKey("2026/09/04"), "2026-09-04");
  assert.equal(normalizeReleaseDateKey("2026-9-4"), "2026-09-04");
  assert.equal(normalizeReleaseDateKey("2026年9月4日"), "2026-09-04");
  assert.equal(normalizeReleaseDateKey("2026.09.04 発売"), "2026-09-04");
  assert.equal(normalizeReleaseDateKey("2026/02/30"), null);
  assert.equal(normalizeReleaseDateKey(null), null);
});

test("日付判定はJSTの0時で切り替わる", () => {
  assert.equal(japanDateKey("2026-09-03T14:59:59.999Z"), "2026-09-03");
  assert.equal(japanDateKey("2026-09-03T15:00:00.000Z"), "2026-09-04");
  assert.equal(isReleaseDateTodayInJapan("2026/09/04", now), true);
  assert.equal(isReleaseDateTodayInJapan("2026/09/05", now), false);
});

test("発売日を迎えた事前登録カードは14日から1日へ昇格する", () => {
  assert.deepEqual(releaseDayCrawlDecision(product(), now), {
    releaseDateKey: "2026-09-04",
    shouldMarkHandled: true,
    shouldSetDaily: true,
  });
});

test("発売日を迎えた巡回停止カードも1日へ昇格する", () => {
  assert.equal(
    releaseDayCrawlDecision(product({ crawlIntervalDays: null }), now).shouldSetDaily,
    true,
  );
});

test("発売日時点ですでに1日なら設定を変えず処理済みだけ記録する", () => {
  assert.deepEqual(
    releaseDayCrawlDecision(product({ crawlIntervalDays: 1 }), now),
    {
      releaseDateKey: "2026-09-04",
      shouldMarkHandled: true,
      shouldSetDaily: false,
    },
  );
});

test("発売日前は昇格も処理済み記録もしない", () => {
  assert.deepEqual(
    releaseDayCrawlDecision(product({ releaseDate: "2026/09/05" }), now),
    {
      releaseDateKey: "2026-09-05",
      shouldMarkHandled: false,
      shouldSetDaily: false,
    },
  );
});

test("発売日にPCが動いていなくても次回起動時に1日へ昇格する", () => {
  const later = new Date("2026-09-07T01:00:00.000Z");
  assert.equal(
    releaseDayCrawlDecision(
      product({ releaseDate: "2026/09/05", createdAt: "2026-09-03T00:00:00.000Z" }),
      later,
    ).shouldSetDaily,
    true,
  );
});

test("機能導入前に発売済みの商品は既存の巡回周期を変えずDB書き込みもしない", () => {
  assert.equal(RELEASE_CRAWL_AUTOMATION_START_DATE, "2026-09-04");
  assert.deepEqual(
    releaseDayCrawlDecision(product({ releaseDate: "2026/08/31" }), now),
    {
      releaseDateKey: "2026-08-31",
      shouldMarkHandled: false,
      shouldSetDaily: false,
    },
  );
});

test("発売後に新規登録した過去作品は1日へ強制変更しない", () => {
  const later = new Date("2026-09-06T01:00:00.000Z");
  assert.deepEqual(
    releaseDayCrawlDecision(
      product({
        releaseDate: "2026/09/04",
        createdAt: "2026-09-05T01:00:00.000Z",
        crawlIntervalDays: 7,
      }),
      later,
    ),
    {
      releaseDateKey: "2026-09-04",
      shouldMarkHandled: false,
      shouldSetDaily: false,
    },
  );
});

test("同じ発売日で一度昇格済みなら後の手動周期変更を上書きしない", () => {
  assert.deepEqual(
    releaseDayCrawlDecision(
      product({ crawlIntervalDays: 14, releaseCrawlPromotedForDate: "2026-09-04" }),
      now,
    ),
    {
      releaseDateKey: "2026-09-04",
      shouldMarkHandled: false,
      shouldSetDaily: false,
    },
  );
});

test("発売日が延期・変更された場合は新しい発売日で再度昇格できる", () => {
  const changedRelease = new Date("2026-09-05T03:00:00.000Z");
  assert.equal(
    releaseDayCrawlDecision(
      product({
        releaseDate: "2026/09/05",
        releaseCrawlPromotedForDate: "2026-09-04",
        crawlIntervalDays: 7,
      }),
      changedRelease,
    ).shouldSetDaily,
    true,
  );
});

test("登録商品APIは昇格を保存して同じ巡回へ1日設定を返す", async () => {
  const route = await readFile("app/api/products/route.ts", "utf8");
  assert.match(route, /releaseDayCrawlDecision/u);
  assert.match(route, /RELEASE_PROMOTION_CHUNK_SIZE = 400/u);
  assert.match(route, /crawlIntervalDays: 1/u);
  assert.match(route, /crawlIntervalReviewedAt: null/u);
  assert.match(route, /releaseCrawlPromotedForDate/u);
  assert.match(route, /promotedIds\.has\(product\.id\) \? 1/u);
});

test("発売日当日の新規追加はメーカー長周期を継承しない", async () => {
  const queue = await readFile("lib/product-import-queue.ts", "utf8");
  assert.match(queue, /isReleaseDateTodayInJapan\(input\.fetched\.releaseDate\)/u);
});

test("Prismaスキーマとmigrationに発売日昇格マーカーがある", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const migration = await readFile(
    "prisma/migrations/20260904120500_add_release_crawl_promotion/migration.sql",
    "utf8",
  );
  assert.match(schema, /releaseCrawlPromotedForDate\s+String\?/u);
  assert.match(migration, /ADD COLUMN "releaseCrawlPromotedForDate" TEXT/u);
});
