import assert from "node:assert/strict";
import test from "node:test";
import { orderedBrandGroups, productIdsAfterBrand } from "./brand-order-bulk";

test("FLATZ自体を含めずブランド順で後ろの商品だけを選ぶ", () => {
  const products = [
    { id: 1, manufacturer: "AAA" },
    { id: 2, manufacturer: "FLATZ" },
    { id: 3, manufacturer: "GGG" },
    { id: 4, manufacturer: "Littlewitch" },
    { id: 5, manufacturer: "リトルウィッチ" },
    { id: 6, manufacturer: "ZZZ" },
    { id: 7, manufacturer: null },
  ];

  const result = productIdsAfterBrand(products, "FLATZ");

  assert.equal(result.boundary.label, "FLATZ");
  assert.deepEqual(result.productIds.sort((left, right) => left - right), [3, 4, 5, 6]);
  assert.ok(!result.productIds.includes(2));
  assert.equal(result.targetBrands.filter((brand) => brand.label.includes("Littlewitch")).length, 1);
});

test("ブランド別名を統合してから五十音・英字順に並べる", () => {
  const groups = orderedBrandGroups([
    { id: 1, manufacturer: "feng" },
    { id: 2, manufacturer: "フォン" },
    { id: 3, manufacturer: "FLATZ" },
  ]);

  const feng = groups.find((group) => group.label.startsWith("feng"));
  assert.ok(feng);
  assert.deepEqual(feng.productIds, [1, 2]);
});

test("基準ブランドが登録されていなければ誤更新せず停止する", () => {
  assert.throws(
    () => productIdsAfterBrand([{ id: 1, manufacturer: "AAA" }], "FLATZ"),
    /基準ブランド「FLATZ」が登録商品に見つかりません/u,
  );
});
