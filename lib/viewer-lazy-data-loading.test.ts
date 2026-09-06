import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const ROOT = process.cwd();
const text = (path: string) => readFile(`${ROOT}/${path}`, "utf8");

test("Viewer exportは毎回DBから用途別JSONを生成する", async () => {
  const exporter = await text("scripts/export-viewer-data.ts");

  assert.match(exporter, /writeCompactJson\("index\.json"/u);
  assert.match(exporter, /writeCompactJson\("changes\.json"/u);
  assert.match(exporter, /writeCompactJson\("products\.json"/u);
  assert.match(exporter, /writeCompactJson\("search-index\.json"/u);
  assert.match(exporter, /writeCompactJson\("detail-index\.json"/u);
  assert.match(exporter, /products\.map\(\(product\) => \[String\(product\.id\), buildProductSearchText\(product\)\]\)/u);
  assert.match(exporter, /products: bootstrapProducts/u);
  assert.match(exporter, /splitData: true/u);
  assert.doesNotMatch(exporter, /searchText:\s*buildProductSearchText/u);
  assert.match(exporter, /JSON\.stringify\(value\)/u);
});

test("初期indexは全商品ではなくタイムセールcountdown用bootstrapだけを持つ", async () => {
  const exporter = await text("scripts/export-viewer-data.ts");

  assert.match(
    exporter,
    /const bootstrapProducts = summaries\.filter\([\s\S]*product\.isTimeSale && product\.timeSaleEndsAt/u,
  );
  assert.match(
    exporter,
    /writeCompactJson\("index\.json", \{[\s\S]*products: bootstrapProducts,[\s\S]*priceChanges: \[\],[\s\S]*splitData: true/u,
  );
});

test("Viewerは画面に必要な分割データだけを遅延取得する", async () => {
  const loader = await text("viewer/lazy-data.js");

  assert.doesNotThrow(() => new vm.Script(loader));
  assert.match(loader, /loadJson\('\.\/data\/changes\.json'\)/u);
  assert.match(loader, /loadJson\('\.\/data\/products\.json'\)/u);
  assert.match(loader, /loadJson\('\.\/data\/search-index\.json'\)/u);
  assert.match(loader, /requestedHash\.startsWith\('#\/changes'\)/u);
  assert.match(loader, /await ensureChanges\(\)/u);
  assert.match(loader, /await ensureProducts\(\)/u);
  assert.match(loader, /route = lazyRoute/u);
  assert.match(loader, /pricewave:viewer-products-loaded/u);
});

test("詳細検索索引と全文検索索引は初期価格変更画面では要求しない", async () => {
  const loader = await text("viewer/lazy-data.js");
  const mobileSearch = await text("viewer/mobile-search.js");

  assert.match(loader, /DETAIL_INDEX_PATTERN/u);
  assert.match(loader, /detailIndexGate\.then/u);
  assert.match(loader, /allowDetailIndex\(\);/u);
  assert.match(loader, /form\.id !== 'viewer-product-search'/u);
  assert.match(loader, /ensureSearchIndex\(\)/u);
  assert.match(mobileSearch, /fetch\('\.\/data\/detail-index\.json'/u);
});

test("旧gh-pages snapshotへの互換fallbackを残す", async () => {
  const loader = await text("viewer/lazy-data.js");
  const seriesFallback = await text("viewer/series-price-data-fallback.js");

  assert.match(loader, /legacySnapshotAvailable/u);
  assert.match(loader, /loadJson\('\.\/data\/index\.json'\)/u);
  assert.match(seriesFallback, /\.\/data\/products\.json/u);
  assert.match(seriesFallback, /return json\('\.\/data\/index\.json'\)/u);
});

test("lazy-dataはapp直後に入りhome-uiは引き続き最後", async () => {
  const html = await text("viewer/index.html");
  const appIndex = html.indexOf("./app.js");
  const lazyIndex = html.indexOf("./lazy-data.js");
  const searchIndex = html.indexOf("./mobile-search.js");
  const homeIndex = html.indexOf("./home-ui.js");
  const lastScriptIndex = html.lastIndexOf("<script");

  assert.ok(appIndex >= 0);
  assert.ok(lazyIndex > appIndex);
  assert.ok(searchIndex > lazyIndex);
  assert.ok(homeIndex > searchIndex);
  assert.equal(lastScriptIndex, html.lastIndexOf('<script src="./home-ui.js'));
});
