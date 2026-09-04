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
