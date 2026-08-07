import assert from "node:assert/strict";
import test from "node:test";
import { shouldSuppressSalePriceChange } from "./time-sale-persistence";

test("通常価格同士の値動きは価格変更として残す", () => {
  assert.equal(
    shouldSuppressSalePriceChange({
      previousIsTimeSale: false,
      currentIsTimeSale: false,
      previousSalePrice: 6000,
      currentSalePrice: 5500,
    }),
    false,
  );
});

test("タイムセール突入時の値下げは価格変更から除外する", () => {
  assert.equal(
    shouldSuppressSalePriceChange({
      previousIsTimeSale: false,
      currentIsTimeSale: true,
      previousSalePrice: 6000,
      currentSalePrice: 5400,
    }),
    true,
  );
});

test("タイムセール中の値動きも価格変更から除外する", () => {
  assert.equal(
    shouldSuppressSalePriceChange({
      previousIsTimeSale: true,
      currentIsTimeSale: true,
      previousSalePrice: 5400,
      currentSalePrice: 5100,
    }),
    true,
  );
});

test("タイムセール終了時に通常価格へ戻る変化も価格変更から除外する", () => {
  assert.equal(
    shouldSuppressSalePriceChange({
      previousIsTimeSale: true,
      currentIsTimeSale: false,
      previousSalePrice: 5400,
      currentSalePrice: 6000,
    }),
    true,
  );
});

test("タイムセール状態だけ変わり価格が同じなら価格変更削除は不要", () => {
  assert.equal(
    shouldSuppressSalePriceChange({
      previousIsTimeSale: false,
      currentIsTimeSale: true,
      previousSalePrice: 6000,
      currentSalePrice: 6000,
    }),
    false,
  );
});
