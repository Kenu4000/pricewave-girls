import assert from "node:assert/strict";
import test from "node:test";
import { detectPrimaryProductCondition } from "./time-sale";

test("BOOK欠品をランクBとして判定する", () => {
  assert.deepEqual(
    detectPrimaryProductCondition(`
      <html><body>
        <h1>テスト商品</h1>
        <div>中古BOOK欠品 22,540円 (税込)</div>
      </body></html>
    `),
    { condition: "BOOK欠品", conditionRank: "B" },
  );
});

test("箱不備をランクBとして判定する", () => {
  assert.deepEqual(
    detectPrimaryProductCondition(`
      <html><body>
        <h1>テスト商品</h1>
        <div>中古【箱不備（大）（汚れ等イタミ有り）】 23,000円 (税込)</div>
      </body></html>
    `),
    { condition: "【箱不備（大）（汚れ等イタミ有り）】", conditionRank: "B" },
  );
});

test("通常中古は通常扱いのまま", () => {
  assert.deepEqual(
    detectPrimaryProductCondition(`
      <html><body>
        <h1>テスト商品</h1>
        <div>中古 6,000円 (税込)</div>
      </body></html>
    `),
    { condition: null, conditionRank: "A" },
  );
});
