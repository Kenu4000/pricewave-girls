import assert from "node:assert/strict";
import test from "node:test";
import { manufacturerForProduct } from "./product-manufacturer-override";

test("メタルオレンジ EXカスタムはカスタムへ補正する", () => {
  assert.equal(manufacturerForProduct("メタルオレンジ EXカスタム", "別メーカー"), "カスタム");
  assert.equal(manufacturerForProduct("メタルオレンジEXカスタム", "別メーカー"), "カスタム");
  assert.equal(
    manufacturerForProduct("メタルオレンジ EXカスタム（説明書欠け）", "別メーカー"),
    "カスタム",
  );
});

test("狂った果実はフェアリーテイルへ補正する", () => {
  assert.equal(manufacturerForProduct("狂った果実", "別メーカー"), "フェアリーテイル");
});

test("他商品は元メーカーを保持する", () => {
  assert.equal(manufacturerForProduct("別の商品", "Leaf"), "Leaf");
});
