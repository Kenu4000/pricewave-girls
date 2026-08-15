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

test("価格詳細ツールチップをグラフ領域の外へ逃がさない", () => {
  assert.match(chart, /allowEscapeViewBox=\{\{ x: false, y: false \}\}/u);
  assert.doesNotMatch(chart, /shouldPlaceTooltipAbove/u);
  assert.doesNotMatch(chart, /tooltipRangeMidpoint/u);
  assert.doesNotMatch(styles, /tooltipAbove/u);
  assert.doesNotMatch(styles, /tooltipBelow/u);
  assert.doesNotMatch(styles, /translateY\(/u);
});
