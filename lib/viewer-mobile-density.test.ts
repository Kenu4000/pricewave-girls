import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();
const text = (path: string) => readFile(`${ROOT}/${path}`, "utf8");

test("Viewerナビからリクエストと周期振り分けを廃止する", async () => {
  const html = await text("viewer/index.html");
  assert.doesNotMatch(html, />リクエスト</u);
  assert.doesNotMatch(html, />周期振り分け</u);
  assert.doesNotMatch(html, /crawl-review\.js/u);
  assert.doesNotMatch(html, /crawl-issue-utils\.js/u);
  assert.doesNotMatch(html, /product-crawl-interval\.js/u);
  assert.doesNotMatch(html, /product-crawl-interval\.css/u);
});

test("巡回周期絞り込みはモバイルで横スクロールなしの6分割グリッドにする", async () => {
  const css = await text("viewer/crawl-interval-display.css");
  assert.match(css, /@media\(max-width:760px\)\{\.crawl-interval-filter\{display:grid/u);
  assert.match(css, /\.crawl-interval-filter-buttons\{display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/u);
  assert.match(css, /overflow:visible/u);
  assert.doesNotMatch(css, /overflow-x:auto/u);
});

test("商品詳細には巡回周期の閲覧用バッジを追加する", async () => {
  const script = await text("viewer/crawl-interval-display.js");
  assert.match(script, /\.detail-prices/u);
  assert.match(script, /detail = false/u);
  assert.match(script, /crawl-interval-detail-badge/u);
  assert.match(script, /a\.product-card/u);
});

test("モバイル商品詳細では軽い巡回周期バッジだけを価格欄へ表示する", async () => {
  const css = await text("viewer/mobile-detail-compact.css");
  const html = await text("viewer/index.html");
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /\.detail-head \.facts\s*\{\s*display:\s*none/su);
  assert.match(css, /#viewer-product-crawl-interval/u);
  assert.match(css, /\.detail-prices \.crawl-interval-detail-badge/u);
  assert.match(html, /mobile-detail-compact\.css\?v=[^"]+/u);
});
