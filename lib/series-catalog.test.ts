import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeriesProductGroups,
  findProductSeries,
  findSeriesCanonicalTitle,
  SERIES_CATALOG,
} from "./series-catalog";

test("添付調査表の173シリーズ・1135タイトルをシリーズカタログへ保持する", () => {
  assert.equal(SERIES_CATALOG.length, 173);
  assert.equal(
    SERIES_CATALOG.reduce((sum, series) => sum + series.titles.length, 0),
    1135,
  );
});

test("商品タイトルからシリーズを判定し正式タイトルへ寄せる", () => {
  const rance = findProductSeries("戦国ランス");
  assert.equal(rance?.id, "S001");
  assert.equal(findSeriesCanonicalTitle("戦国ランス", rance!), "戦国ランス");

  const withEdition = findProductSeries("戦国ランス Windows 10対応版");
  assert.equal(withEdition?.id, "S001");
  assert.equal(
    findSeriesCanonicalTitle("戦国ランス Windows 10対応版", withEdition!),
    "戦国ランス",
  );
});

test("駿河屋の機種・媒体カテゴリ前置きが付いていてもシリーズを判定する", () => {
  const title = "WindowsXP/Vista/7/8 DVD ソフト ランス01 光をもとめて";
  const series = findProductSeries(title);
  assert.equal(series?.id, "S001");
  assert.equal(findSeriesCanonicalTitle(title, series!), "ランス01 光をもとめて");

  const cdTitle = "Windows98/Me/2000/XP CDソフト 鬼畜王ランス";
  const cdSeries = findProductSeries(cdTitle);
  assert.equal(cdSeries?.id, "S001");
  assert.equal(findSeriesCanonicalTitle(cdTitle, cdSeries!), "鬼畜王ランス");
});

test("長い正式タイトルを優先して隣接シリーズへの誤分類を避ける", () => {
  const dungeon = findProductSeries("ToHeart2 ダンジョントラベラーズ");
  assert.equal(dungeon?.id, "S042");
});

test("ランクB等の状態表記が付いたタイトルでも同じシリーズへ寄せる", () => {
  const series = findProductSeries("鬼畜王ランス（説明書なし）");
  assert.equal(series?.id, "S001");
});

test("+などタイトルを識別する記号は別作品として保持する", () => {
  const amakano = findProductSeries("アマカノ＋");
  assert.equal(amakano?.id, "S152");
  assert.equal(findSeriesCanonicalTitle("アマカノ＋", amakano!), "アマカノ＋");

  const custom = findProductSeries("カスタムメイド3D2+");
  assert.equal(custom?.id, "S145");
  assert.equal(findSeriesCanonicalTitle("カスタムメイド3D2+", custom!), "カスタムメイド3D2+");
});

test("同一作品に通常品がある場合はランクB登録をシリーズ線から除外する", () => {
  const series = findProductSeries("戦国ランス");
  assert.ok(series);
  const groups = buildSeriesProductGroups(series, [
    { id: 1, title: "戦国ランス", conditionRank: "A", condition: null },
    { id: 2, title: "戦国ランス（説明書なし）", conditionRank: "B", condition: "説明書なし" },
    { id: 3, title: "鬼畜王ランス", conditionRank: "A", condition: null },
  ]);

  assert.deepEqual(
    groups.map((group) => [group.title, group.productIds]),
    [
      ["鬼畜王ランス", [3]],
      ["戦国ランス", [1]],
    ],
  );
});

test("同じシリーズ作品のedition違いは別々の価格線として保持する", () => {
  const series = findProductSeries("ランス01 光をもとめて");
  assert.ok(series);

  const groups = buildSeriesProductGroups(series, [
    {
      id: 10,
      title: "WindowsXP/Vista/7/8 DVD ソフト ランス01 光をもとめて",
      conditionRank: "A",
      condition: null,
    },
    {
      id: 11,
      title: "WindowsXP/Vista/7/8 DVD ソフト ランス01 光をもとめて 廉価版",
      conditionRank: "A",
      condition: null,
    },
  ]);

  assert.deepEqual(
    groups.map((group) => [group.title, group.productIds]),
    [
      ["ランス01 光をもとめて", [10]],
      ["ランス01 光をもとめて 廉価版", [11]],
    ],
  );
});
