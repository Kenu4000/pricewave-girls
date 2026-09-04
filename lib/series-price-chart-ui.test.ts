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
});

test("シリーズ表示は閉じた状態ではシリーズボタンだけを出す", async () => {
  const component = await text("components/SeriesPriceChart.tsx");

  assert.match(component, /const \[open, setOpen\] = useState\(false\)/u);
  assert.match(component, />\s*シリーズ\s*</u);
  assert.match(component, /販売価格の推移を1本ずつ重ねて表示/u);
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

test("作品を選ぶと他の線を薄くして注目作品を固定できる", async () => {
  const component = await text("components/SeriesPriceChart.tsx");
  const css = await text("components/SeriesPriceChart.module.css");

  assert.match(component, /selectedTitle/u);
  assert.match(component, /hoveredTitle/u);
  assert.match(component, /focusedTitle/u);
  assert.match(component, /opacity=\{dimmed \? 0\.12 : 1\}/u);
  assert.match(component, /aria-pressed=\{selectedTitle === line\.title\}/u);
  assert.match(css, /\.focusedLine/u);
  assert.match(css, /\.legendDimmed/u);
  assert.match(css, /\.hitLine/u);
});
