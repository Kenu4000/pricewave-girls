import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("商品一覧に1・3・7・14日・無の巡回周期ボタンを表示する", async () => {
  const grid = await readFile(new URL("../components/ProductGrid.tsx", import.meta.url), "utf8");
  assert.match(grid, /1日/u);
  assert.match(grid, /3日/u);
  assert.match(grid, /7日/u);
  assert.match(grid, /14日/u);
  assert.match(grid, /label: "無"/u);
  assert.match(grid, /aria-pressed/u);
  assert.match(grid, /crawl-interval/u);
});

test("自動巡回は商品周期、手動更新は全件を選ぶ", async () => {
  const wrapper = await readFile(
    new URL("../browser-extension/popular-refresh-wrapper.js", import.meta.url),
    "utf8",
  );
  assert.match(wrapper, /VALID_INTERVALS = new Set\(\[1, 3, 7, 14\]\)/u);
  assert.match(wrapper, /product\?\.crawlIntervalDays === null/u);
  assert.match(wrapper, /source\.filter\(\(product\) => isDue\(product, now\)\)/u);
  assert.match(wrapper, /manualFullRun \? source/u);
  assert.doesNotMatch(wrapper, /dailyCrawlBrandOverrideEnabled|dailyCrawlBrands/u);
});

test("popupから日次巡回ブランド設定を廃止する", async () => {
  const html = await readFile(new URL("../browser-extension/popup.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<span class="setting-heading">日次巡回ブランド<\/span>/u);
  assert.match(html, /今すぐ全件更新/u);
  assert.match(html, /1日 \/ 3日 \/ 7日 \/ 14日 \/ 無/u);
});
