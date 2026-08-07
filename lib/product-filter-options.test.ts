import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductFilterCatalog,
  detailFilterValue,
  extractOperatingSystems,
  findPriceBand,
  normalizeFilterChoiceValue,
  type FilterSourceProduct,
} from "./product-filter-options";

function product(
  id: number,
  overrides: Partial<FilterSourceProduct> = {},
): FilterSourceProduct {
  return {
    id,
    manufacturer: null,
    releaseDate: null,
    category: null,
    detailsJson: null,
    ...overrides,
  };
}

test("ブランドの全角・大文字小文字・空白の表記揺れを同じ候補にまとめる", () => {
  const catalog = buildProductFilterCatalog([
    product(1, { manufacturer: "Key" }),
    product(2, { manufacturer: "ＫＥＹ" }),
    product(3, { manufacturer: " key " }),
    product(4, { manufacturer: "Leaf" }),
  ]);

  assert.equal(catalog.brands.options.featured.length, 1);
  assert.equal(catalog.brands.options.featured[0].label, "Key");
  assert.equal(catalog.brands.options.featured[0].count, 3);
  assert.deepEqual(catalog.brands.productIds.get("key"), [1, 2, 3]);
});

test("英字名と日本語名のブランド別名を同じ候補にまとめる", () => {
  const catalog = buildProductFilterCatalog([
    product(1, { manufacturer: "戯画" }),
    product(2, { manufacturer: "GIGA" }),
    product(3, { manufacturer: "ALICESOFT" }),
    product(4, { manufacturer: "ありすそふと" }),
    product(5, { manufacturer: "アリスソフト" }),
  ]);

  const gigaKey = normalizeFilterChoiceValue("GIGA");
  const aliceKey = normalizeFilterChoiceValue("ありすそふと");

  assert.equal(gigaKey, normalizeFilterChoiceValue("戯画"));
  assert.equal(aliceKey, normalizeFilterChoiceValue("ALICESOFT"));
  assert.deepEqual(catalog.brands.productIds.get(gigaKey), [1, 2]);
  assert.deepEqual(catalog.brands.productIds.get(aliceKey), [3, 4, 5]);

  const options = [
    ...catalog.brands.options.featured,
    ...catalog.brands.options.alphabetical,
  ];
  assert.equal(options.filter((option) => option.label === "戯画").length, 1);
  assert.equal(options.filter((option) => option.label === "ALICESOFT").length, 1);
});

test("対応OSの複数バージョンと表記揺れを統合する", () => {
  assert.deepEqual(extractOperatingSystems("Windows 10/11、Mac OS X", "WinXP"), [
    "Windows 11",
    "Windows 10",
    "Windows XP",
    "macOS",
  ]);

  const catalog = buildProductFilterCatalog([
    product(1, {
      category: "Windows",
      detailsJson: JSON.stringify({ 対応OS: "Windows 10/11" }),
    }),
    product(2, { detailsJson: JSON.stringify({ OS: "Ｗｉｎｄｏｗｓ １０" }) }),
  ]);
  assert.deepEqual(catalog.operatingSystems.productIds.get("Windows 10"), [1, 2]);
  assert.deepEqual(catalog.operatingSystems.productIds.get("Windows 11"), [1]);
});

test("原画・シナリオ・声優を人物ごとの選択肢に分ける", () => {
  const catalog = buildProductFilterCatalog([
    product(1, {
      releaseDate: "2024-06-28",
      detailsJson: JSON.stringify({
        原画: "樋上いたる、Na-Ga",
        シナリオ: "麻枝准 / 魁",
        声優: "A; B",
      }),
    }),
  ]);

  assert.equal(catalog.illustrators.options.alphabetical.length, 2);
  assert.equal(catalog.scenarios.options.alphabetical.length, 2);
  assert.equal(catalog.voiceActors.options.alphabetical.length, 2);
  assert.deepEqual(catalog.releaseYears, ["2024"]);
});

test("価格帯の境界を提供する", () => {
  assert.deepEqual(findPriceBand("3000-4999"), {
    value: "3000-4999",
    label: "3,000〜4,999円",
    min: 3_000,
    max: 4_999,
  });
  assert.equal(findPriceBand("invalid"), undefined);
});

test("壊れた詳細JSONは候補生成を止めない", () => {
  const catalog = buildProductFilterCatalog([product(1, { detailsJson: "{" })]);
  assert.deepEqual(catalog.releaseYears, []);
  assert.deepEqual(catalog.illustrators.options.alphabetical, []);
});

test("商品詳細の値を表記揺れを吸収して同じ商品の絞り込みに使う", () => {
  const catalog = buildProductFilterCatalog([
    product(1, { detailsJson: JSON.stringify({ メーカー: "Leaf" }) }),
  ]);

  assert.deepEqual(
    catalog.detailProductIds.get(detailFilterValue("メーカー", "Ｌｅａｆ")),
    [1],
  );
});
