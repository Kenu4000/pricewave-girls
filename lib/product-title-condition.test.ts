import assert from "node:assert/strict";
import test from "node:test";
import {
  conditionAnnotatedProductIds,
  hasTrailingConditionAnnotation,
} from "./product-title-condition";

test("タイトル末尾の状態表記を検出する", () => {
  assert.equal(hasTrailingConditionAnnotation("AIR(状態：ディスクのみ)"), true);
  assert.equal(hasTrailingConditionAnnotation("Kanon（状態：説明書欠品）"), true);
  assert.equal(hasTrailingConditionAnnotation("CLANNAD ( 状態 : ケース不備 ) "), true);
});

test("通常の括弧を状態表記として扱わない", () => {
  assert.equal(hasTrailingConditionAnnotation("AIR(初回限定版)"), false);
  assert.equal(hasTrailingConditionAnnotation("作品名（Windows版）"), false);
  assert.equal(hasTrailingConditionAnnotation("状態：説明書欠品"), false);
});

test("状態表記付き商品のIDだけを抽出する", () => {
  assert.deepEqual(
    conditionAnnotatedProductIds([
      { id: 1, title: "AIR" },
      { id: 2, title: "Kanon(状態：ディスクのみ)" },
      { id: 3, title: "CLANNAD（状態：箱不備）" },
    ]),
    [2, 3],
  );
});
