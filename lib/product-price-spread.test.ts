import assert from "node:assert/strict";
import test from "node:test";
import { sortProductsByPriceSpread } from "./product-price-spread";

const products = [
  { id: 1, title: "B", latestSalePrice: 5000, latestBuyPrice: 1000 },
  { id: 2, title: "A", latestSalePrice: 3000, latestBuyPrice: 2000 },
  { id: 3, title: "C", latestSalePrice: null, latestBuyPrice: 1000 },
  { id: 4, title: "D", latestSalePrice: 1000, latestBuyPrice: 2500 },
];

test("販売価格と買取価格の差が小さい順に並べる", () => {
  assert.deepEqual(
    sortProductsByPriceSpread(products, "asc").map((product) => product.id),
    [2, 4, 1, 3],
  );
});

test("販売価格と買取価格の差が大きい順に並べ、未取得は最後にする", () => {
  assert.deepEqual(
    sortProductsByPriceSpread(products, "desc").map((product) => product.id),
    [1, 4, 2, 3],
  );
});
