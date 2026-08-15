import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bulkUi = readFileSync(
  new URL("../components/BrandCrawlIntervalBulk.tsx", import.meta.url),
  "utf8",
);
const listCount = readFileSync(
  new URL("../components/ProductListCount.tsx", import.meta.url),
  "utf8",
);
const bulkRoute = readFileSync(
  new URL("../app/api/products/crawl-intervals/by-brand/route.ts", import.meta.url),
  "utf8",
);

test("ブランド絞り込み時の一括変更UIに5周期を横並びで用意する", () => {
  assert.match(bulkUi, /1日/u);
  assert.match(bulkUi, /3日/u);
  assert.match(bulkUi, /7日/u);
  assert.match(bulkUi, /14日/u);
  assert.match(bulkUi, /label: "無"/u);
  assert.match(listCount, /<BrandCrawlIntervalBulk \/>/u);
});

test("ブランド一括変更APIはブランド索引の全商品をupdateManyする", () => {
  assert.match(bulkRoute, /catalog\.brands\.productIds\.get\(brand\)/u);
  assert.match(bulkRoute, /prisma\.product\.updateMany/u);
  assert.match(bulkRoute, /where: \{ id: \{ in: target\.productIds \} \}/u);
});

test("一括変更UIはブランドの全登録件数を明示する", () => {
  assert.match(bulkUi, /このブランドの登録商品 \{summary\.count\}件すべてに適用/u);
  assert.match(bulkUi, /useSearchParams/u);
});
