import assert from "node:assert/strict";
import test from "node:test";
import { productInterestScore, sortProductsByInterest } from "./product-interest-score";

const NOW = new Date("2026-08-17T14:00:00.000Z");

function change(
  previousPrice: number,
  currentPrice: number,
  dayOffset: number,
  type: "sale" | "buy" = "sale",
) {
  return {
    type,
    previousPrice,
    currentPrice,
    changedAt: new Date(NOW.getTime() - dayOffset * 24 * 60 * 60 * 1000),
  };
}

test("一度だけ大きく動く商品より上下を繰り返す商品を注目しやすくする", () => {
  const singleJump = productInterestScore([change(3000, 8000, 1)], NOW);
  const zigzag = productInterestScore(
    [
      change(3000, 5000, 4),
      change(5000, 3500, 3),
      change(3500, 7000, 2),
      change(7000, 4500, 1),
    ],
    NOW,
  );

  assert.ok(zigzag.reversalCount > singleJump.reversalCount);
  assert.ok(zigzag.score > singleJump.score);
});

test("同じ値動きなら最近動いた商品を高くする", () => {
  const recent = productInterestScore([change(3000, 4500, 1)], NOW);
  const old = productInterestScore([change(3000, 4500, 90)], NOW);
  assert.ok(recent.score > old.score);
});

test("販売と買取の両方の変更回数と反転を評価する", () => {
  const score = productInterestScore(
    [
      change(3000, 4000, 5, "sale"),
      change(4000, 3500, 4, "sale"),
      change(1000, 1500, 3, "buy"),
      change(1500, 1200, 2, "buy"),
    ],
    NOW,
  );

  assert.equal(score.changeCount, 4);
  assert.equal(score.reversalCount, 2);
});

test("価格変更がない商品は注目度0にする", () => {
  assert.equal(productInterestScore([], NOW).score, 0);
});

test("注目度、高い方の最終変更日時、商品名の順で安定して並べる", () => {
  const products = [
    { id: 1, title: "A", priceChanges: [change(3000, 3200, 10)] },
    {
      id: 2,
      title: "B",
      priceChanges: [
        change(3000, 5000, 4),
        change(5000, 3500, 3),
        change(3500, 7000, 2),
      ],
    },
  ];

  assert.deepEqual(sortProductsByInterest(products, NOW).map((product) => product.id), [2, 1]);
});
