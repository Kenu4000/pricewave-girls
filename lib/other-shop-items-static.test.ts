import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parser = readFileSync(
  new URL("./other-shop-items.ts", import.meta.url),
  "utf8",
);

test("他店舗安全パーサはtenpo_cdまたはbranch_numberを店舗出品根拠にする", () => {
  assert.match(parser, /searchParams\.has\("tenpo_cd"\)/u);
  assert.match(parser, /searchParams\.has\("branch_number"\)/u);
  assert.match(parser, /の出品を見る/u);
});

test("商品詳細表だけでは店舗出品として扱わない", () => {
  assert.match(parser, /if \(!storeName && !conditionAnchor\) return/u);
});
