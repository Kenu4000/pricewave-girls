import assert from "node:assert/strict";
import test from "node:test";
import { shouldPlaceTooltipAbove } from "./tooltip-position";

test("高価格帯ではツールチップを上側へ逃がす", () => {
  assert.equal(shouldPlaceTooltipAbove(8000, 5000), true);
});

test("低価格帯ではツールチップを下側へ残す", () => {
  assert.equal(shouldPlaceTooltipAbove(3000, 5000), false);
});

test("価格範囲が不明なら標準の下側表示を維持する", () => {
  assert.equal(shouldPlaceTooltipAbove(3000, null), false);
});
