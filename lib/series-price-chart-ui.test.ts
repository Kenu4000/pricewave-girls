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
