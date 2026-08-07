import assert from "node:assert/strict";
import test from "node:test";
import {
  conditionAnnotatedProductIds,
  hasTrailingConditionAnnotation,
  splitProductTitleCondition,
} from "./product-title-condition";

test("タイトル末尾の状態表記を検出する", () => {
  assert.equal(hasTrailingConditionAnnotation("AIR(状態：ディスクのみ)"), true);
  assert.equal(hasTrailingConditionAnnotation("Kanon（状態：説明書欠品）"), true);
  assert.equal(hasTrailingConditionAnnotation("CLANNAD ( 状態 : ケース不備 ) "), true);
});

test("入れ子括弧を含む状態表記をタイトルから分離する", () => {
  assert.deepEqual(
    splitProductTitleCondition(
      "Windows2000/XP/Vista/7 DVDソフト 智代アフター(状態：箱(内箱含む)・テクニカルマニュアル欠品)",
    ),
    {
      title: "Windows2000/XP/Vista/7 DVDソフト 智代アフター",
      condition: "箱(内箱含む)・テクニカルマニュアル欠品",
      conditionRank: "B",
    },
  );
});

test("状態ラベルがなくても明確な欠品表記はランクBとして分離する", () => {
  assert.deepEqual(
    splitProductTitleCondition(
      "WindowsVista/7/8 DVDソフト 智代アフター ～It’s a Wonderful Life～ PerfectEdition（テクニカルマニュアル欠品）",
    ),
    {
      title:
        "WindowsVista/7/8 DVDソフト 智代アフター ～It’s a Wonderful Life～ PerfectEdition",
      condition: "テクニカルマニュアル欠品",
      conditionRank: "B",
    },
  );
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
      { id: 3, title: "CLANNAD", condition: "箱不備", conditionRank: "B" },
    ]),
    [2, 3],
  );
});
