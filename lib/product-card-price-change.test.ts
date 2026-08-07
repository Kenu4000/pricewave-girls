import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductCardPriceChangeSummaries,
  classifySaleAvailabilityState,
  formatPriceChangeAge,
  formatProductCardPriceChange,
  formatTimeSaleCardPriceChange,
  hasCurrentOtherShopInventory,
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

test("売価が未取得になった理由を通販・全体在庫で分ける", () => {
  const soldOut = {
    type: "sale" as const,
    previousPrice: 5_000,
    currentPrice: null,
    changedAt: "2026-08-08T00:00:00.000Z",
  };

  assert.equal(
    classifySaleAvailabilityState(soldOut, "out_of_stock", true),
    "mail_order_sold_out",
  );
  assert.equal(
    classifySaleAvailabilityState(soldOut, "out_of_stock", false),
    "out_of_stock",
  );
  assert.equal(
    classifySaleAvailabilityState(soldOut, "unknown", false),
    "unfetched",
  );
});

test("未取得から価格が付いた売価は入荷として扱う", () => {
  assert.equal(
    classifySaleAvailabilityState(
      {
        type: "sale",
        previousPrice: null,
        currentPrice: 4_800,
        changedAt: "2026-08-08T00:00:00.000Z",
      },
      "in_stock",
      false,
    ),
    "restocked",
  );
});

test("最新取得時刻と同時刻帯の他ショップだけを現在在庫として扱う", () => {
  const latest = new Date("2026-08-08T00:00:30.000Z");
  assert.equal(
    hasCurrentOtherShopInventory(latest, [
      {
        sourceType: "other_shop",
        checkedAt: new Date("2026-08-08T00:00:10.000Z"),
      },
    ]),
    true,
  );
  assert.equal(
    hasCurrentOtherShopInventory(latest, [
      {
        sourceType: "other_shop",
        checkedAt: new Date("2026-08-07T23:50:00.000Z"),
      },
    ]),
    false,
  );
  assert.equal(
    hasCurrentOtherShopInventory(latest, [
      {
        sourceType: "alternate_condition",
        checkedAt: new Date("2026-08-08T00:00:30.000Z"),
      },
    ]),
    false,
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
  assert.equal(
    formatProductCardPriceChange(
      {
        type: "sale",
        previousPrice: 5_000,
        currentPrice: null,
        changedAt: new Date(2026, 7, 8, 1, 0).toISOString(),
        availabilityState: "mail_order_sold_out",
      },
      now,
    ),
    "売価 通販売り切れ・今日",
  );
  assert.equal(
    formatProductCardPriceChange(
      {
        type: "sale",
        previousPrice: null,
        currentPrice: 5_000,
        changedAt: new Date(2026, 7, 8, 1, 0).toISOString(),
        availabilityState: "restocked",
      },
      now,
    ),
    "売価 入荷・今日",
  );
});

test("タイムセールは通常価格との差額と開始日だけを専用表記する", () => {
  const now = new Date(2026, 7, 8, 5, 0, 0);
  assert.equal(
    formatTimeSaleCardPriceChange(
      5_000,
      4_100,
      new Date(2026, 7, 7, 12, 0).toISOString(),
      now,
    ),
    "タイムセール↓-900円・昨日",
  );
  assert.equal(formatTimeSaleCardPriceChange(5_000, 4_100, null, now), "タイムセール↓-900円");
});
