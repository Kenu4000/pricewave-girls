import assert from "node:assert/strict";
import test from "node:test";
import { buildPriceChangeWhere } from "./price-change-events";

test("価格種別・ブランド・商品名を組み合わせて絞り込む", () => {
  assert.deepEqual(
    buildPriceChangeWhere({
      type: "sale",
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
    buildPriceChangeWhere({ type: "all", brand: "", query: "" }),
    {},
  );
});

test("買取価格だけを商品名で検索できる", () => {
  assert.deepEqual(
    buildPriceChangeWhere({ type: "buy", brand: "", query: "AIR" }),
    {
      type: "buy",
      product: { is: { title: { contains: "AIR" } } },
    },
  );
});
