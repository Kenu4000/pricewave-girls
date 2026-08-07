import assert from "node:assert/strict";
import test from "node:test";
import {
  conditionAnnotatedProductIds,
  hasTrailingConditionAnnotation,
  parseProductTitleCondition,
} from "./product-title-condition";

test("タイトル末尾の状態表記を検出する", () => {
  assert.equal(hasTrailingConditionAnnotation("AIR(状態：ディスクのみ)"), true);
  assert.equal(hasTrailingConditionAnnotation("Kanon（状態：説明書欠品）"), true);
  assert.equal(hasTrailingConditionAnnotation("CLANNAD ( 状態 : ケース不備 ) "), true);
});

test("状態という接頭辞がなくても欠品や不備の括弧を検出する", () => {
  assert.deepEqual(
    parseProductTitleCondition(
      "WindowsVista/7/8 DVDソフト 智代アフター ～It’s a Wonderful Life～ PerfectEdition（テクニカルマニュアル欠品）",
    ),
    {
      title:
        "WindowsVista/7/8 DVDソフト 智代アフター ～It’s a Wonderful Life～ PerfectEdition",
      condition: "テクニカルマニュアル欠品",
    },
  );
  assert.deepEqual(parseProductTitleCondition("AIR(箱不備)(説明書欠品)"), {
    title: "AIR",
    condition: "箱不備 / 説明書欠品",
  });
});

test("通常の括弧を状態表記として扱わない", () => {
  assert.equal(hasTrailingConditionAnnotation("AIR(初回限定版)"), false);
  assert.equal(hasTrailingConditionAnnotation("作品名（Windows版）"), false);
  assert.equal(hasTrailingConditionAnnotation("状態：説明書欠品"), false);
  assert.deepEqual(parseProductTitleCondition("傷物語（完全版）"), {
    title: "傷物語（完全版）",
    condition: null,
  });
});

test("状態表記付き商品のIDだけを抽出する", () => {
  assert.deepEqual(
    conditionAnnotatedProductIds([
      { id: 1, title: "AIR" },
      { id: 2, title: "Kanon(状態：ディスクのみ)" },
      { id: 3, title: "CLANNAD（箱不備）" },
      { id: 4, title: "智代アフター（初回限定版）" },
    ]),
    [2, 3],
  );
});
