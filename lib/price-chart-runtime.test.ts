import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("商品詳細の価格グラフはRechartsを使わずSVGで描画する", async () => {
  const component = await readFile(
    new URL("../components/PriceChart.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(component, /from ["']recharts["']/u);
  assert.doesNotMatch(component, /ResponsiveContainer|LineChart|ReferenceLine/u);
  assert.match(component, /<svg/u);
  assert.match(component, /販売価格/u);
  assert.match(component, /買取価格/u);
  assert.match(component, /ランクB/u);
  assert.match(component, /タイムセール/u);
});
