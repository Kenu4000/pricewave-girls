import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(
  new URL("../components/PriceChart.tsx", import.meta.url),
  "utf8",
);

test("価格推移ツールチップは系列数が変わっても4行固定にする", () => {
  assert.match(chart, /const TOOLTIP_SERIES = \[/u);
  assert.match(chart, /name: "販売価格"/u);
  assert.match(chart, /name: "買取価格"/u);
  assert.match(chart, /name: "ランクB"/u);
  assert.match(chart, /name: "タイムセール"/u);
  assert.match(chart, /TOOLTIP_SERIES\.map\(\(series\)/u);
  assert.match(chart, /yenFormatter\(valuesByName\.get\(series\.name\) \?\? null\)/u);
});

test("Recharts側でもnull系列を落とさずツールチップ移動アニメーションを止める", () => {
  assert.match(chart, /filterNull=\{false\}/u);
  assert.match(chart, /isAnimationActive=\{false\}/u);
});

test("可変行数にする旧filter処理を使わない", () => {
  assert.doesNotMatch(chart, /rows\.filter/u);
  assert.doesNotMatch(chart, /payload\.length === 0/u);
});
