import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("商品詳細の既存価格グラフ直下にシリーズ表示を追加する", async () => {
  const page = await text("app/products/[id]/page.tsx");
  const priceChart = page.indexOf("<PriceChart histories={histories} />");
  const seriesChart = page.indexOf("<SeriesPriceChart");

  assert.ok(priceChart >= 0);
  assert.ok(seriesChart > priceChart);
  assert.match(page, /findProductSeries\(product\.title\)/u);
  assert.match(page, /buildSeriesProductGroups/u);
  assert.match(page, /prisma\.priceHistory\.findMany/u);
  assert.match(page, /representativeProductId/u);
  assert.match(page, /productId: representativeProductId/u);
});

test("シリーズ表示は閉じた状態ではシリーズボタンだけを出す", async () => {
  const component = await text("components/SeriesPriceChart.tsx");

  assert.match(component, /const \[open, setOpen\] = useState\(false\)/u);
  assert.match(component, />\s*シリーズ\s*</u);
  assert.match(component, /parsedLines\.map/u);
  assert.match(component, /currentPrice/u);
});

test("価格差が大きいシリーズは自動で対数目盛を使える", async () => {
  const component = await text("components/SeriesPriceChart.tsx");

  assert.match(component, /const AUTO_LOG_RATIO = 8/u);
  assert.match(component, /scaleMode === "auto" && rawMax \/ rawMin >= AUTO_LOG_RATIO/u);
  assert.match(component, /Math\.log10/u);
  assert.match(component, />\s*自動\s*</u);
  assert.match(component, />\s*通常\s*</u);
  assert.match(component, />\s*対数\s*</u);
  assert.match(component, /価格差が大きいため、自動で対数目盛/u);
});

test("通常価格グラフと同様に日週月と時点選択で価格を確認できる", async () => {
  const component = await text("components/SeriesPriceChart.tsx");
  const css = await text("components/SeriesPriceChart.module.css");

  assert.match(component, /type PriceChartMode/u);
  assert.match(component, /aggregatePriceChartData/u);
  assert.match(component, /日（全期間）/u);
  assert.match(component, /label: "週"/u);
  assert.match(component, /label: "月"/u);
  assert.match(component, /selectedTimestamp/u);
  assert.match(component, /onPointerMove=\{selectByPointer\}/u);
  assert.match(component, /pointAtOrBefore/u);
  assert.match(component, /className=\{styles\.readout\}/u);
  assert.match(css, /\.readout/u);
  assert.match(css, /\.selectionLine/u);
});

test("縦軸は省略記号ではなく実際の円価格を表示する", async () => {
  const component = await text("components/SeriesPriceChart.tsx");

  assert.match(component, /function axisYen/u);
  assert.match(component, /toLocaleString\("ja-JP"\).*円/u);
  assert.match(component, />\{axisYen\(value\)\}</u);
});

test("作品の強調を保ちつつ凡例の商品名から商品詳細へ移動できる", async () => {
  const component = await text("components/SeriesPriceChart.tsx");
  const css = await text("components/SeriesPriceChart.module.css");

  assert.match(component, /selectedTitle/u);
  assert.match(component, /hoveredTitle/u);
  assert.match(component, /focusedTitle/u);
  assert.match(component, /opacity=\{dimmed \? 0\.12 : 1\}/u);
  assert.match(component, /productId: number/u);
  assert.match(component, /href=\{`\/products\/\$\{line\.productId\}`\}/u);
  assert.match(component, /商品名を押すとその商品詳細へ移動します/u);
  assert.match(css, /\.focusedLine/u);
  assert.match(css, /\.legendDimmed/u);
  assert.match(css, /\.hitLine/u);
  assert.match(css, /\.legend a/u);
});
