import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductSearchText,
  includesSearchText,
  normalizeSearchText,
  productIncludesSearchText,
} from "./search-text";

test("商品名検索はASCIIの大文字小文字を区別しない", () => {
  assert.equal(includesSearchText("Kanon KEY Memorial", "key"), true);
  assert.equal(includesSearchText("Kanon key Memorial", "KEY"), true);
  assert.equal(includesSearchText("Kanon KeY Memorial", "kEy"), true);
});

test("検索文字列は全角英字も同じ文字として扱う", () => {
  assert.equal(normalizeSearchText("ＫＥＹ"), "key");
  assert.equal(includesSearchText("KEY", "ｋｅｙ"), true);
});

test("商品検索はブランド・発売日・OS・原画・シナリオ・声優も対象にする", () => {
  const product = {
    title: "Kanon",
    manufacturer: "Key",
    releaseDate: "1999-06-04",
    category: "Windows",
    modelNumber: "VA-001",
    managementNumber: "145000001",
    detailsJson: JSON.stringify({
      対応OS: "Windows 98/Me/2000/XP",
      原画: "樋上いたる",
      シナリオ: "久弥直樹 / 麻枝准",
      声優: "國府田マリ子",
      __pricewaveTimeSale: "1",
    }),
  };

  for (const query of [
    "key",
    "1999",
    "windows 98",
    "樋上いたる",
    "麻枝准",
    "國府田マリ子",
    "va-001",
    "145000001",
  ]) {
    assert.equal(productIncludesSearchText(product, query), true, query);
  }
  assert.equal(productIncludesSearchText(product, "タイムセール"), false);
});

test("Viewer用検索文字列も同じ正規化済みメタデータを含む", () => {
  const searchText = buildProductSearchText({
    title: "AIR",
    manufacturer: "Ｋｅｙ",
    detailsJson: JSON.stringify({ 原画: "樋上いたる" }),
  });

  assert.match(searchText, /air/u);
  assert.match(searchText, /key/u);
  assert.match(searchText, /樋上いたる/u);
});
