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
