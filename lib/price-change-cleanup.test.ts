import assert from "node:assert/strict";
import test from "node:test";
import {
  isSmallPriceChange,
  SMALL_PRICE_CHANGE_THRESHOLD,
} from "./price-change-cleanup";

test("300円以内の価格変更を削除対象にする", () => {
  assert.equal(SMALL_PRICE_CHANGE_THRESHOLD, 300);
  assert.equal(isSmallPriceChange(1000, 1200), true);
  assert.equal(isSmallPriceChange(1000, 1300), true);
  assert.equal(isSmallPriceChange(1300, 1000), true);
  assert.equal(isSmallPriceChange(1000, 1301), false);
  assert.equal(isSmallPriceChange(1301, 1000), false);
});

test("未取得価格を小幅変動として削除しない", () => {
  assert.equal(isSmallPriceChange(null, 1000), false);
  assert.equal(isSmallPriceChange(1000, null), false);
  assert.equal(isSmallPriceChange(null, null), false);
});
