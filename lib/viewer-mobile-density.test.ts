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

test("巡回周期絞り込みはモバイルで一行の横並びを維持する", async () => {
  const css = await text("viewer/crawl-interval-display.css");
  assert.match(css, /@media\(max-width:760px\)\{\.crawl-interval-filter\{display:flex/u);
  assert.match(css, /\.crawl-interval-filter-buttons\{display:flex/u);
  assert.match(css, /overflow-x:auto/u);
  assert.doesNotMatch(css, /repeat\(3,minmax\(0,1fr\)\)/u);
  assert.doesNotMatch(css, /repeat\(2,minmax\(0,1fr\)\)/u);
});

test("商品詳細には巡回周期を装飾しない", async () => {
  const script = await text("viewer/crawl-interval-display.js");
  assert.doesNotMatch(script, /\.detail-prices/u);
  assert.doesNotMatch(script, /detail\s*=\s*false/u);
  assert.match(script, /a\.product-card/u);
});

test("モバイル商品詳細では上部の軽い詳細を隠す", async () => {
  const css = await text("viewer/mobile-detail-compact.css");
  const html = await text("viewer/index.html");
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /\.detail-head \.facts\s*\{\s*display:\s*none/su);
  assert.match(css, /#viewer-product-crawl-interval/u);
  assert.match(css, /\.detail-prices \.crawl-interval-badge/u);
  assert.match(html, /mobile-detail-compact\.css\?v=202608191413/u);
});
