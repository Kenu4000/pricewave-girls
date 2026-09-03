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

test("価格情報は点そのものではなく取得点のX位置に対応する縦帯で選択する", async () => {
  const component = await readFile(
    new URL("../components/PriceChart.tsx", import.meta.url),
    "utf8",
  );

  assert.match(component, /const left = index === 0 \? LEFT : \(xAt\(index - 1\) \+ center\) \/ 2/u);
  assert.match(component, /const right = index === data\.length - 1 \? WIDTH - RIGHT : \(center \+ xAt\(index \+ 1\)\) \/ 2/u);
  assert.match(component, /<rect[\s\S]*fill="transparent"[\s\S]*height=\{plotHeight\}/u);
  assert.match(component, /onPointerEnter=\{\(\) => selectPoint\(point\)\}/u);
  assert.match(component, /onPointerMove=\{\(\) => selectPoint\(point\)\}/u);
});
