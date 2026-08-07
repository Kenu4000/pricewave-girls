import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductCardPriceChangeSummaries,
  formatPriceChangeAge,
  formatProductCardPriceChange,
  productCardPriceChangeDirection,
} from "./product-card-price-change";

test("商品ごとに売価・買取の最新変更だけを残す", () => {
  const summaries = buildProductCardPriceChangeSummaries([
    {
      productId: 1,
      type: "sale",
      previousPrice: 5_000,
      currentPrice: 5_500,
      changedAt: new Date("2026-08-08T00:00:00+09:00"),
    },
    {
      productId: 1,
      type: "sale",
      previousPrice: 4_500,
      currentPrice: 5_000,
      changedAt: new Date("2026-08-07T00:00:00+09:00"),
    },
    {
      productId: 1,
      type: "buy",
      previousPrice: 3_500,
      currentPrice: 3_000,
      changedAt: new Date("2026-08-06T00:00:00+09:00"),
    },
  ]);

  assert.equal(summaries[1].sale?.previousPrice, 5_000);
  assert.equal(summaries[1].sale?.currentPrice, 5_500);
  assert.equal(summaries[1].buy?.currentPrice, 3_000);
});

test("値上げ・値下げを判定する", () => {
  assert.equal(
    productCardPriceChangeDirection({
      type: "sale",
      previousPrice: 1_000,
      currentPrice: 1_500,
      changedAt: "2026-08-08T00:00:00.000Z",
    }),
    "up",
  );
  assert.equal(
    productCardPriceChangeDirection({
      type: "buy",
      previousPrice: 2_000,
      currentPrice: 1_500,
      changedAt: "2026-08-08T00:00:00.000Z",
    }),
    "down",
  );
});

test("変更時期を今日・昨日・n日前で表示する", () => {
  const now = new Date(2026, 7, 8, 5, 0, 0);
  assert.equal(formatPriceChangeAge(new Date(2026, 7, 8, 0, 1).toISOString(), now), "今日");
  assert.equal(formatPriceChangeAge(new Date(2026, 7, 7, 23, 59).toISOString(), now), "昨日");
  assert.equal(formatPriceChangeAge(new Date(2026, 7, 3, 12, 0).toISOString(), now), "5日前");
});

test("カード用ラベルに種別・方向・差額・何日前かを含める", () => {
  const now = new Date(2026, 7, 8, 5, 0, 0);
  assert.equal(
    formatProductCardPriceChange(
      {
        type: "sale",
        previousPrice: 5_000,
        currentPrice: 5_500,
        changedAt: new Date(2026, 7, 6, 10, 0).toISOString(),
      },
      now,
    ),
    "売価 ↑ +500円・2日前",
  );
  assert.equal(
    formatProductCardPriceChange(
      {
        type: "buy",
        previousPrice: 3_200,
        currentPrice: 2_900,
        changedAt: new Date(2026, 7, 8, 1, 0).toISOString(),
      },
      now,
    ),
    "買取 ↓ -300円・今日",
  );
});
