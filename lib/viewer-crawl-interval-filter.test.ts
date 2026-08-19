import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewerの商品一覧を巡回周期で絞り込める", async () => {
  const script = await readFile(new URL("../viewer/crawl-interval-filter.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");

  assert.match(script, /1日/u);
  assert.match(script, /3日/u);
  assert.match(script, /7日/u);
  assert.match(script, /14日/u);
  assert.match(script, /label: '無'/u);
  assert.match(script, /product\.crawlIntervalDays == null/u);
  assert.match(script, /Number\(product\.crawlIntervalDays\) === Number\(state\.crawlInterval\)/u);
  assert.match(script, /originalFilteredProducts\(source\)\.filter\(matchesCrawlInterval\)/u);
  assert.match(script, /state\.page = 1/u);
  assert.match(script, /絞り込み結果：/u);
  assert.match(script, /globalThis\.filteredProducts\(\)\.length/u);
  assert.match(script, /MutationObserver\(updateFilteredCount\)/u);

  const mobileSearchIndex = html.indexOf('./mobile-search.js');
  const intervalFilterIndex = html.indexOf('./crawl-interval-filter.js');
  assert.ok(mobileSearchIndex >= 0);
  assert.ok(intervalFilterIndex > mobileSearchIndex);
});

test("Viewer巡回周期フィルタはモバイルで一行かつ横スクロール不要", async () => {
  const css = await readFile(new URL("../viewer/crawl-interval-display.css", import.meta.url), "utf8");
  assert.match(css, /@media\(max-width:760px\)/u);
  assert.match(css, /grid-template-columns:auto minmax\(0,1fr\)/u);
  assert.match(css, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/u);
  assert.match(css, /overflow:visible/u);
  assert.doesNotMatch(css, /@media\(max-width:760px\)[\s\S]*?overflow-x:auto/u);
});
