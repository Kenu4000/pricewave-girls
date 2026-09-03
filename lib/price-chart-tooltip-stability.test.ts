import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(
  new URL("../components/PriceChart.tsx", import.meta.url),
  "utf8",
);

test("価格推移の選択点詳細は系列数が変わっても4系列固定にする", () => {
  assert.match(chart, /const SERIES = \[/u);
  assert.match(chart, /name: "販売価格"/u);
  assert.match(chart, /name: "買取価格"/u);
  assert.match(chart, /name: "ランクB"/u);
  assert.match(chart, /name: "タイムセール"/u);
  assert.match(chart, /SERIES\.map\(\(series\)/u);
  assert.match(chart, /yen\(seriesValue\(selectedPoint, series\.key\)\)/u);
  assert.match(chart, /aria-live="polite"/u);
});

test("価格詳細は浮動Rechartsツールチップを使わず固定readoutで表示する", () => {
  assert.match(chart, /className=\{styles\.readout\}/u);
  assert.doesNotMatch(chart, /from ["']recharts["']/u);
  assert.doesNotMatch(chart, /<Tooltip|filterNull=|isAnimationActive=/u);
});

test("可変行数にする旧filter処理を使わない", () => {
  assert.doesNotMatch(chart, /rows\.filter/u);
  assert.doesNotMatch(chart, /payload\.length === 0/u);
});
