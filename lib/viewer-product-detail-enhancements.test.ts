import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("Viewer価格履歴は初期状態で格納する", async () => {
  const js = await text("viewer/product-detail-enhancements.js");
  const css = await text("viewer/product-detail-enhancements.css");
  assert.match(js, /heading\?\.textContent\?\.trim\(\) !== '価格履歴'/u);
  assert.match(js, /document\.createElement\('details'\)/u);
  assert.match(js, /document\.createElement\('summary'\)/u);
  assert.match(js, /section\.replaceChildren\(details\)/u);
  assert.doesNotMatch(js, /details\.open\s*=\s*true/u);
  assert.match(css, /\.viewer-price-history-summary/u);
  assert.doesNotThrow(() => new Function(js));
});

test("Viewerの商品詳細人物欄は複数人を個別リンクにする", async () => {
  const js = await text("viewer/detail-filter-links.js");
  const exporter = await text("scripts/export-viewer-data.ts");
  assert.match(js, /PEOPLE_DETAIL_LABELS/u);
  assert.match(js, /原画/u);
  assert.match(js, /シナリオ/u);
  assert.match(js, /声優/u);
  assert.match(js, /splitDetailValues/u);
  assert.match(js, /document\.createTextNode\('、'\)/u);
  assert.match(js, /detailFilterHref\(label, part\)/u);
  assert.match(js, /function detailFilterIds\(filter\)/u);
  assert.match(js, /indexedValue\.includes\(valueKey\)/u);
  assert.match(exporter, /splitDetailPeople/u);
  assert.match(exporter, /detailIndexValues/u);
  assert.match(exporter, /for \(const indexedValue of detailIndexValues\(label, value\)\)/u);
  assert.doesNotThrow(() => new Function(js));
});

test("モバイル商品詳細は軽いfactsを隠し巡回周期バッジを価格欄に表示する", async () => {
  const css = await text("viewer/mobile-detail-compact.css");
  const intervalJs = await text("viewer/crawl-interval-display.js");
  assert.match(css, /\.detail-head \.facts\s*\{\s*display:\s*none/su);
  assert.match(css, /\.detail-prices \.crawl-interval-detail-badge\s*\{\s*display:\s*none/su);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.detail-prices \.crawl-interval-detail-badge\s*\{\s*display:\s*inline-flex/su);
  assert.match(intervalJs, /detail \? `巡回周期 \$\{meta\.label\}`/u);
  assert.match(intervalJs, /const detailId = location\.hash\.match/u);
  assert.match(intervalJs, /prices\.appendChild\(element\)/u);
  assert.match(intervalJs, /crawl-interval-detail-badge/u);
  assert.doesNotThrow(() => new Function(intervalJs));
});

test("Viewer商品詳細改善スクリプトをindexから読み込む", async () => {
  const html = await text("viewer/index.html");
  assert.match(html, /crawl-interval-display\.js\?v=202608191514/u);
  assert.match(html, /detail-filter-links\.js\?v=202608191453/u);
  assert.match(html, /product-detail-enhancements\.js\?v=202608191453/u);
  assert.match(html, /product-detail-enhancements\.css\?v=202608191453/u);
  assert.match(html, /mobile-detail-compact\.css\?v=202608191514/u);
});
