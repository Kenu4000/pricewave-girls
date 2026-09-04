import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();
const text = (path: string) => readFile(`${ROOT}/${path}`, "utf8");

test("Viewer公開時にシリーズ価格データも生成する", async () => {
  const packageJson = JSON.parse(await text("package.json")) as { scripts: Record<string, string> };
  const exporter = await text("scripts/export-viewer-series-data.ts");

  assert.match(packageJson.scripts["viewer:export"], /export-viewer-series-data\.ts/u);
  assert.match(exporter, /buildSeriesProductGroups/u);
  assert.match(exporter, /findProductSeries/u);
  assert.match(exporter, /series-index\.json/u);
  assert.match(exporter, /SERIES_DATA_DIR/u);
  assert.match(exporter, /`\$\{series\.id\}\.json`/u);
  assert.match(exporter, /productIds\[0\]/u);
  assert.doesNotMatch(exporter, /flatMap\(\(seriesProductId\)/u);
});

test("Viewer商品詳細でシリーズグラフを読み込み商品詳細へ遷移できる", async () => {
  const script = await text("viewer/series-price-chart.js");
  const html = await text("viewer/index.html");

  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /series-index\.json/u);
  assert.match(script, /日（全期間）/u);
  assert.match(script, /data-series-scale/u);
  assert.match(script, /Math\.log10/u);
  assert.match(script, /axisYen/u);
  assert.match(script, /href="#\/products\/\$\{line\.productId\}"/u);
  assert.match(script, /editionHint = line\.modelNumber \|\| `#\$\{line\.productId\}`/u);
  assert.match(script, /data-series-product="\$\{line\.productId\}"/u);

  const seriesScript = html.indexOf("./series-price-chart.js");
  const homeScript = html.indexOf("./home-ui.js");
  assert.ok(seriesScript >= 0);
  assert.ok(homeScript > seriesScript, "home-ui.jsは引き続き最後に読み込む");
  assert.match(html, /series-price-chart\.css/u);
});

test("公開済みViewerにシリーズJSONがなくても既存商品JSONから補完できる", async () => {
  const fallback = await text("viewer/series-price-data-fallback.js");
  const html = await text("viewer/index.html");

  assert.doesNotThrow(() => new Function(fallback));
  assert.match(fallback, /SERIES_INDEX_PATTERN/u);
  assert.match(fallback, /SERIES_DATA_PATTERN/u);
  assert.match(fallback, /raw\.githubusercontent\.com\/Kenu4000\/pricewave-girls\/main\/data\/series-catalog/u);
  assert.match(fallback, /\.\/data\/index\.json/u);
  assert.match(fallback, /\.\/data\/products\/\$\{product\.id\}\.json/u);
  assert.match(fallback, /productId: product\.id/u);
  assert.match(fallback, /original\.status !== 404/u);
  assert.match(fallback, /\.filter\(isNormalConditionProduct\)/u);
  assert.doesNotMatch(fallback, /normal\.length\s*\?\s*normal\s*:\s*matches/u);

  const fallbackScript = html.indexOf("./series-price-data-fallback.js");
  const seriesScript = html.indexOf("./series-price-chart.js");
  const homeScript = html.indexOf("./home-ui.js");
  assert.ok(fallbackScript >= 0);
  assert.ok(seriesScript > fallbackScript, "補完fetchはシリーズUIより先に読み込む");
  assert.ok(homeScript > seriesScript, "home-ui.jsは引き続き最後に読み込む");
});
