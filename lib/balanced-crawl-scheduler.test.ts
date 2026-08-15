import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

type CrawlProduct = {
  id: number;
  crawlIntervalDays: 1 | 3 | 7 | 14 | null;
  lastCheckedAt: string | null;
};

type Plan = {
  products: CrawlProduct[];
  dailyCount: number;
  balancedCount: number;
  balancedTarget: number;
  deferredCount: number;
  totalRegistered: number;
};

const scheduler = require("../browser-extension/balanced-crawl-scheduler.js") as {
  BALANCE_CYCLE_DAYS: number;
  balancedDailyTarget(products: CrawlProduct[], value: Date | number): number;
  selectBalancedProducts(products: CrawlProduct[], value: Date | number): Plan;
};

function daysBefore(date: Date, days: number): string {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1_000).toISOString();
}

test("7日周期21件は期限が同日に来ても3件ずつ巡回する", () => {
  const now = new Date("2026-08-16T00:00:00Z");
  const products = Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    crawlIntervalDays: 7 as const,
    lastCheckedAt: daysBefore(now, 7),
  }));

  const plan = scheduler.selectBalancedProducts(products, now);
  assert.equal(plan.balancedTarget, 3);
  assert.equal(plan.balancedCount, 3);
  assert.equal(plan.deferredCount, 18);
});

test("7日周期22件は7日間で3件か4件に均等分散する", () => {
  const start = new Date("2026-08-16T00:00:00Z");
  const products: CrawlProduct[] = Array.from({ length: 22 }, (_, index) => ({
    id: index + 1,
    crawlIntervalDays: 7,
    lastCheckedAt: daysBefore(start, 7),
  }));
  const counts: number[] = [];
  const selectedIds = new Set<number>();

  for (let day = 0; day < 7; day += 1) {
    const now = new Date(start.getTime() + day * 24 * 60 * 60 * 1_000);
    const plan = scheduler.selectBalancedProducts(products, now);
    counts.push(plan.balancedCount);
    for (const product of plan.products) {
      if (product.crawlIntervalDays !== 7) continue;
      selectedIds.add(product.id);
      product.lastCheckedAt = now.toISOString();
    }
  }

  assert.equal(selectedIds.size, 22);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 22);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});

test("3日・7日・14日周期を合算した理論巡回数を42日周期で均等化する", () => {
  const products: CrawlProduct[] = [
    ...Array.from({ length: 6 }, (_, index) => ({ id: index + 1, crawlIntervalDays: 3 as const, lastCheckedAt: null })),
    ...Array.from({ length: 7 }, (_, index) => ({ id: index + 101, crawlIntervalDays: 7 as const, lastCheckedAt: null })),
    ...Array.from({ length: 14 }, (_, index) => ({ id: index + 201, crawlIntervalDays: 14 as const, lastCheckedAt: null })),
  ];
  const start = new Date("2026-08-16T00:00:00Z");
  const targets = Array.from({ length: scheduler.BALANCE_CYCLE_DAYS }, (_, day) =>
    scheduler.balancedDailyTarget(
      products,
      new Date(start.getTime() + day * 24 * 60 * 60 * 1_000),
    ),
  );

  // 6*(42/3) + 7*(42/7) + 14*(42/14) = 168回/42日 = 4回/日
  assert.deepEqual(new Set(targets), new Set([4]));
});

test("巡回枠が0の日でも期限到来商品があれば最低1件は処理する", () => {
  const product: CrawlProduct = {
    id: 1,
    crawlIntervalDays: 14,
    lastCheckedAt: "2026-07-01T00:00:00Z",
  };
  const start = new Date("2026-08-16T00:00:00Z");
  let zeroQuotaDate: Date | null = null;

  for (let day = 0; day < 14; day += 1) {
    const candidate = new Date(start.getTime() + day * 24 * 60 * 60 * 1_000);
    if (scheduler.balancedDailyTarget([product], candidate) === 0) {
      zeroQuotaDate = candidate;
      break;
    }
  }

  assert.ok(zeroQuotaDate);
  const plan = scheduler.selectBalancedProducts([product], zeroQuotaDate!);
  assert.equal(plan.balancedCount, 1);
  assert.equal(plan.products[0]?.id, 1);
});

test("同じ巡回枠なら周期に対する超過率が大きい商品を先に回す", () => {
  const now = new Date("2026-08-16T00:00:00Z");
  const products: CrawlProduct[] = [
    { id: 1, crawlIntervalDays: 7, lastCheckedAt: daysBefore(now, 8) },
    { id: 2, crawlIntervalDays: 7, lastCheckedAt: daysBefore(now, 20) },
  ];

  const plan = scheduler.selectBalancedProducts(products, now);
  assert.equal(plan.balancedCount, 1);
  assert.equal(plan.products[0]?.id, 2);
});

test("1日周期は従来どおり期限到来分を全件回し、無は除外する", () => {
  const now = new Date("2026-08-16T00:00:00Z");
  const products: CrawlProduct[] = [
    { id: 1, crawlIntervalDays: 1, lastCheckedAt: daysBefore(now, 1) },
    { id: 2, crawlIntervalDays: 1, lastCheckedAt: daysBefore(now, 1) },
    { id: 3, crawlIntervalDays: null, lastCheckedAt: daysBefore(now, 100) },
  ];

  const plan = scheduler.selectBalancedProducts(products, now);
  assert.deepEqual(plan.products.map((product) => product.id), [1, 2]);
  assert.equal(plan.dailyCount, 2);
  assert.equal(plan.balancedCount, 0);
});
