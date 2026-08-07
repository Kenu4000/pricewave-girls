import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const policy = require("../browser-extension/crawl-policy.js") as {
  rotationBucket(value: Date | number): number;
  selectScheduledProducts(
    products: Array<{
      id: number;
      url: string;
      brand?: string | null;
      brands?: string[];
      dailyByTitle?: boolean;
      crawlPriority: "daily" | "rotation";
    }>,
    value: Date | number,
    exactDailyUrls?: string[],
    dailyBrandOverride?: { enabled: boolean; brands: string[] } | null,
  ): {
    products: Array<{ id: number }>;
    dailyCount: number;
    rotationCount: number;
    customDailyBrandCount: number | null;
  };
};

function product(
  id: number,
  brand: string,
  crawlPriority: "daily" | "rotation",
  dailyByTitle = false,
) {
  return {
    id,
    url: `https://www.suruga-ya.jp/product/detail/${5000 + id}`,
    brand,
    brands: [brand],
    dailyByTitle,
    crawlPriority,
  };
}

test("上書きOFFでは従来のcrawlPriorityを使う", () => {
  const date = new Date(2026, 7, 8, 9, 0, 0);
  const bucket = policy.rotationBucket(date);
  const legacyDaily = product(99, "Key", "daily");
  const rotation = product(bucket, "Other", "rotation");

  const plan = policy.selectScheduledProducts(
    [legacyDaily, rotation],
    date,
    [],
    { enabled: false, brands: ["Other"] },
  );

  assert.deepEqual(plan.products.map((item) => item.id), [99, bucket]);
  assert.equal(plan.customDailyBrandCount, null);
});

test("上書きONでは指定ブランドだけをブランド日次対象にする", () => {
  const date = new Date(2026, 7, 8, 9, 0, 0);
  const bucket = policy.rotationBucket(date);
  const oldDefault = product((bucket + 1) % 3, "Key", "daily");
  const newlySelected = product((bucket + 2) % 3, "Leaf", "rotation");

  const plan = policy.selectScheduledProducts(
    [oldDefault, newlySelected],
    date,
    [],
    { enabled: true, brands: ["Leaf"] },
  );

  assert.deepEqual(plan.products.map((item) => item.id), [newlySelected.id]);
  assert.equal(plan.dailyCount, 1);
  assert.equal(plan.rotationCount, 0);
  assert.equal(plan.customDailyBrandCount, 1);
});

test("ブランド表記は記号やスラッシュ違いを吸収する", () => {
  const date = new Date(2026, 7, 8, 9, 0, 0);
  const target = product(101, "HOOK", "rotation");

  const plan = policy.selectScheduledProducts(
    [target],
    date,
    [],
    { enabled: true, brands: ["HOOKSOFT / HOOK"] },
  );

  assert.deepEqual(plan.products.map((item) => item.id), [101]);
});

test("個別の日次指定商品はブランド上書きで外れない", () => {
  const date = new Date(2026, 7, 8, 9, 0, 0);
  const titleDaily = product(102, "Other", "rotation", true);

  const plan = policy.selectScheduledProducts(
    [titleDaily],
    date,
    [],
    { enabled: true, brands: [] },
  );

  assert.deepEqual(plan.products.map((item) => item.id), [102]);
});
