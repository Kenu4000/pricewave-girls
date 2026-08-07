import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPriceChangeWhere,
  matchesPriceChangeDirection,
} from "./price-change-events";

test("価格種別・ブランド・商品名を組み合わせて絞り込む", () => {
  assert.deepEqual(
    buildPriceChangeWhere({
      type: "sale",
      direction: "all",
      brand: "Key",
      query: "Kanon",
    }),
    {
      type: "sale",
      product: {
        is: {
          manufacturer: "Key",
          title: { contains: "Kanon" },
        },
      },
    },
  );
});

test("未指定の条件はクエリへ含めない", () => {
  assert.deepEqual(
    buildPriceChangeWhere({
      type: "all",
      direction: "all",
      brand: "",
      query: "",
    }),
    {},
  );
});

test("買取価格だけを商品名で検索できる", () => {
  assert.deepEqual(
    buildPriceChangeWhere({
      type: "buy",
      direction: "all",
      brand: "",
      query: "AIR",
    }),
    {
      type: "buy",
      product: { is: { title: { contains: "AIR" } } },
    },
  );
});

test("ブランドインデックスの対象商品IDで絞り込める", () => {
  assert.deepEqual(
    buildPriceChangeWhere(
      {
        type: "all",
        direction: "all",
        brand: "key",
        query: "",
      },
      [1, 3, 5],
    ),
    {
      product: { is: { id: { in: [1, 3, 5] } } },
    },
  );
});

test("値上げと値下がりを価格差で判定する", () => {
  assert.equal(matchesPriceChangeDirection(1000, 1200, "up"), true);
  assert.equal(matchesPriceChangeDirection(1200, 1000, "up"), false);
  assert.equal(matchesPriceChangeDirection(1200, 1000, "down"), true);
  assert.equal(matchesPriceChangeDirection(1000, 1200, "down"), false);
  assert.equal(matchesPriceChangeDirection(null, 1200, "up"), false);
  assert.equal(matchesPriceChangeDirection(1200, null, "down"), false);
  assert.equal(matchesPriceChangeDirection(null, null, "all"), true);
});
