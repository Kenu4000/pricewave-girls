import assert from "node:assert/strict";
import test from "node:test";
import {
  nextProductRevealDelay,
  prependUniqueProduct,
  PRODUCT_REVEAL_MAX_DELAY_MS,
  PRODUCT_REVEAL_MIN_DELAY_MS,
} from "./product-preview";

test("一覧へ流す間隔を105〜330ミリ秒に収める", () => {
  assert.equal(nextProductRevealDelay(() => 0), PRODUCT_REVEAL_MIN_DELAY_MS);
  assert.equal(nextProductRevealDelay(() => 0.999999), PRODUCT_REVEAL_MAX_DELAY_MS);
});

test("新しい商品を先頭へ追加し、表示件数を維持する", () => {
  const products = prependUniqueProduct([{ id: 2 }, { id: 1 }], { id: 3 }, 2);
  assert.deepEqual(products, [{ id: 3 }, { id: 2 }]);
});

test("既存商品は重複させず更新後データへ置き換える", () => {
  const products = prependUniqueProduct(
    [{ id: 2, title: "更新前" }, { id: 1, title: "別商品" }],
    { id: 2, title: "更新後" },
    24,
  );
  assert.deepEqual(products, [
    { id: 2, title: "更新後" },
    { id: 1, title: "別商品" },
  ]);
});
