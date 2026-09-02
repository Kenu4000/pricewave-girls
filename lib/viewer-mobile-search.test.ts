import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = readFileSync(
  new URL("../viewer/mobile-search.js", import.meta.url),
  "utf8",
);
const html = readFileSync(
  new URL("../viewer/index.html", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../viewer/product-list-main-ui.css", import.meta.url),
  "utf8",
);
const exporter = readFileSync(
  new URL("../scripts/export-viewer-data.ts", import.meta.url),
  "utf8",
);

test("Viewerの商品検索スクリプトを構文解析できる", () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test("Viewer検索はmainと同じ上段構成を持つ", () => {
  assert.match(script, /id="viewer-product-search"/u);
  assert.match(script, /class="primary-search-grid"/u);
  assert.match(script, /<span>検索<\/span>/u);
  assert.match(script, /<span>並び順<\/span>/u);
  assert.match(script, /<span>表示件数<\/span>/u);
  assert.match(script, />検索<\/button>/u);
  assert.match(script, />クリア<\/button>/u);
  assert.match(script, /商品名・ブランド・原画など/u);
});

test("Viewer詳細検索はmainと同じ項目を持つ", () => {
  for (const label of [
    "ブランド",
    "OS",
    "原画",
    "シナリオ",
    "声優",
    "発売年度",
    "販売価格帯",
    "買取価格帯",
    "在庫状態",
    "タイトルの状態表記",
  ]) {
    assert.match(script, new RegExp(`<span>${label}<\\/span>`, "u"));
  }
  assert.match(script, /class="advanced-search"/u);
  assert.match(script, /条件設定中/u);
});

test("Viewer並び順はmainの候補を持つ", () => {
  for (const value of [
    "interesting_desc",
    "updated_desc",
    "updated_asc",
    "sale_asc",
    "sale_desc",
    "buy_desc",
    "buy_asc",
    "spread_desc",
    "spread_asc",
    "release_desc",
    "release_asc",
  ]) {
    assert.match(script, new RegExp(`value="${value}"`, "u"));
  }
  assert.match(script, /販売・買取の差が大きい順/u);
  assert.match(script, /販売・買取の差が小さい順/u);
});

test("Viewer検索は商品名だけでなくブランド・発売日・詳細情報も対象にする", () => {
  assert.match(script, /product\.searchText \|\| fallback/u);
  assert.match(script, /product\.manufacturer/u);
  assert.match(script, /product\.releaseDate/u);
  assert.match(script, /detailMatchingProductIds/u);
  assert.match(script, /normalize\('NFKC'\)/u);
  assert.match(exporter, /searchText:\s*buildProductSearchText\(product\)/u);
});

test("詳細検索は価格帯・在庫・状態表記を実際の絞り込みに使う", () => {
  assert.match(script, /matchesPriceBand\(product\.latestSalePrice, state\.saleBand\)/u);
  assert.match(script, /matchesPriceBand\(product\.latestBuyPrice, state\.buyBand\)/u);
  assert.match(script, /matchesStock\(product\)/u);
  assert.match(script, /matchesConditionTitle\(product\)/u);
  assert.match(script, /optionMatchesProduct\(product, 'operatingSystems'/u);
  assert.match(script, /optionMatchesProduct\(product, 'illustrators'/u);
  assert.match(script, /optionMatchesProduct\(product, 'scenarios'/u);
  assert.match(script, /optionMatchesProduct\(product, 'voiceActors'/u);
});

test("検索はmain同様フォーム送信で確定しクリアで初期化する", () => {
  assert.match(script, /addEventListener\('submit'/u);
  assert.match(script, /readSearchForm\(\)/u);
  assert.match(script, /clearSearchFilters\(\)/u);
  assert.doesNotMatch(script, /querySelector\('#q'\)\.addEventListener\('input'/u);
});

test("Viewer検索UIのCSSはデスクトップとモバイルでmain型の配置を持つ", () => {
  assert.match(css, /\.viewer-search-panel \.primary-search-grid/u);
  assert.match(css, /grid-template-columns:\s*minmax\(260px, 2fr\)/u);
  assert.match(css, /\.viewer-search-panel \.advanced-filter-grid/u);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.doesNotMatch(css, /overflow-x:\s*auto/u);
});

test("検索修正はapp.jsの後に読み込まれキャッシュキーを持つ", () => {
  const appIndex = html.search(/<script src="\.\/app\.js\?v=[^"]+"><\/script>/u);
  const searchIndex = html.search(/<script src="\.\/mobile-search\.js\?v=[^"]+"><\/script>/u);
  assert.ok(appIndex >= 0);
  assert.ok(searchIndex > appIndex);
  assert.match(html, /product-list-main-ui\.css\?v=[^"]+/u);
  assert.match(script, /globalThis\.renderProducts\s*=\s*renderProductsStableSearch/u);
});
