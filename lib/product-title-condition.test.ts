import assert from "node:assert/strict";
import test from "node:test";
import {
  conditionAnnotatedProductIds,
  conditionUnannotatedProductIds,
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

test("末尾括弧のランクB表記を状態として分離する", () => {
  assert.deepEqual(
    splitProductTitleCondition("WindowsXP/Vista/7 DVDソフト DEAR DROPS（ランクB）"),
    {
      title: "WindowsXP/Vista/7 DVDソフト DEAR DROPS",
      condition: "ランクB",
      conditionRank: "B",
    },
  );
  assert.deepEqual(splitProductTitleCondition("DEAR DROPS（ランクＢ）"), {
    title: "DEAR DROPS",
    condition: "ランクB",
    conditionRank: "B",
  });
});

test("説明書欠けを欠品系のランクBとして分離する", () => {
  assert.deepEqual(
    splitProductTitleCondition(
      "Windows7/8/8.1/10 DVDソフト 戯画ロイヤルスウィートコレクション（説明書欠け）",
    ),
    {
      title: "Windows7/8/8.1/10 DVDソフト 戯画ロイヤルスウィートコレクション",
      condition: "説明書欠け",
      conditionRank: "B",
    },
  );
});

test("複数の構成物しかない表記をランクBとして分離する", () => {
  assert.deepEqual(
    splitProductTitleCondition(
      "Windows95/98/Me/2000/XP CDソフト Quartett![初回版]（ゲームディスク+説明書のみ）",
    ),
    {
      title: "Windows95/98/Me/2000/XP CDソフト Quartett![初回版]",
      condition: "ゲームディスク+説明書のみ",
      conditionRank: "B",
    },
  );
});

test("駿河屋のランクB接頭表記を状態として分離する", () => {
  assert.deepEqual(
    splitProductTitleCondition(
      "WindowsVista/7/8 DVDソフト ランクB)智代アフター ～It’s a Wonderful Life～ PerfectEdition",
    ),
    {
      title: "WindowsVista/7/8 DVDソフト 智代アフター ～It’s a Wonderful Life～ PerfectEdition",
      condition: "ランクB",
      conditionRank: "B",
    },
  );
  assert.deepEqual(splitProductTitleCondition("【ランクB】Kanon"), {
    title: "Kanon",
    condition: "ランクB",
    conditionRank: "B",
  });
  assert.deepEqual(splitProductTitleCondition("【ランクＢ】Kanon"), {
    title: "Kanon",
    condition: "ランクB",
    conditionRank: "B",
  });
});

test("通常の括弧を状態表記として扱わない", () => {
  assert.equal(hasTrailingConditionAnnotation("AIR(初回限定版)"), false);
  assert.equal(hasTrailingConditionAnnotation("作品名（Windows版）"), false);
  assert.equal(hasTrailingConditionAnnotation("作品名（Windows版のみ）"), false);
  assert.equal(hasTrailingConditionAnnotation("作品名（ゲームディスク版）"), false);
  assert.equal(hasTrailingConditionAnnotation("状態：説明書欠品"), false);
});

test("状態表記付き商品のIDだけを抽出する", () => {
  assert.deepEqual(
    conditionAnnotatedProductIds([
      { id: 1, title: "AIR" },
      { id: 2, title: "Kanon(状態：ディスクのみ)" },
      { id: 3, title: "CLANNAD", condition: "箱不備", conditionRank: "B" },
      { id: 4, title: "Windows DVDソフト ランクB)智代アフター" },
      { id: 5, title: "DEAR DROPS（ランクB）" },
      { id: 6, title: "戯画ロイヤルスウィートコレクション（説明書欠け）" },
      { id: 7, title: "Quartett![初回版]（ゲームディスク+説明書のみ）" },
    ]),
    [2, 3, 4, 5, 6, 7],
  );
});

test("状態表記なし商品のIDだけを抽出する", () => {
  assert.deepEqual(
    conditionUnannotatedProductIds([
      { id: 1, title: "AIR" },
      { id: 2, title: "Kanon(状態：ディスクのみ)" },
      { id: 3, title: "CLANNAD", condition: "箱不備", conditionRank: "B" },
      { id: 4, title: "Windows DVDソフト ランクB)智代アフター" },
      { id: 5, title: "DEAR DROPS（ランクB）" },
      { id: 6, title: "戯画ロイヤルスウィートコレクション（説明書欠け）" },
      { id: 7, title: "Quartett![初回版]（ゲームディスク+説明書のみ）" },
    ]),
    [1],
  );
});
