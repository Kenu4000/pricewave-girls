import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chart = readFileSync(
  new URL("../components/PriceChart.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../components/PriceChart.module.css", import.meta.url),
  "utf8",
);

test("価格詳細はグラフ外の固定readoutに表示し浮動ツールチップを使わない", () => {
  assert.match(chart, /className=\{styles\.readout\}/u);
  assert.match(chart, /className=\{styles\.chartWrap\}/u);
  assert.match(styles, /\.readout \{/u);
  assert.match(styles, /\.chartWrap \{[\s\S]*overflow: hidden;/u);
  assert.doesNotMatch(chart, /allowEscapeViewBox/u);
  assert.doesNotMatch(chart, /shouldPlaceTooltipAbove/u);
  assert.doesNotMatch(chart, /tooltipRangeMidpoint/u);
  assert.doesNotMatch(styles, /tooltipAbove/u);
  assert.doesNotMatch(styles, /tooltipBelow/u);
  assert.doesNotMatch(styles, /translateY\(/u);
});
