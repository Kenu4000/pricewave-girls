import assert from "node:assert/strict";
import test from "node:test";

function shouldPlaceTooltipAbove(average: number, rangeMidpoint: number | null) {
  return rangeMidpoint !== null && average >= rangeMidpoint;
}

test("高価格帯ではツールチップを上側へ逃がす", () => {
  assert.equal(shouldPlaceTooltipAbove(8000, 5000), true);
});

test("低価格帯ではツールチップを下側へ残す", () => {
  assert.equal(shouldPlaceTooltipAbove(3000, 5000), false);
});
