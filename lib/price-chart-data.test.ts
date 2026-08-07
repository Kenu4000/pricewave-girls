import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePriceChartData, type PriceChartHistory } from "./price-chart-data";

function point(checkedAt: string, salePrice: number): PriceChartHistory {
  return { checkedAt, salePrice, buyPrice: Math.floor(salePrice / 2) };
}

test("日表示は全期間の全取得時点を残す", () => {
  const data = aggregatePriceChartData(
    [
      point("2026-06-30T12:00:00.000Z", 1000),
      point("2026-07-10T09:00:00.000Z", 2000),
      point("2026-07-10T18:00:00.000Z", 2200),
      point("2026-08-05T12:00:00.000Z", 3000),
    ],
    "day",
  );

  assert.deepEqual(data.map((entry) => entry.salePrice), [1000, 2000, 2200, 3000]);
  assert.deepEqual(data.map((entry) => entry.checkedAt), [
    "2026-06-30T12:00:00.000Z",
    "2026-07-10T09:00:00.000Z",
    "2026-07-10T18:00:00.000Z",
    "2026-08-05T12:00:00.000Z",
  ]);
  assert.doesNotMatch(data[0].label, /:/u);
  assert.match(data[1].label, /09:00|9:00/u);
  assert.match(data[2].label, /18:00/u);
  assert.doesNotMatch(data[3].label, /:/u);
});

test("同日中の価格変化をすべて残す", () => {
  const data = aggregatePriceChartData(
    [
      point("2026-08-05T09:00:00.000Z", 5000),
      point("2026-08-05T12:00:00.000Z", 4000),
      point("2026-08-05T18:00:00.000Z", 5000),
    ],
    "day",
  );

  assert.deepEqual(data.map((entry) => entry.salePrice), [5000, 4000, 5000]);
  assert.equal(new Set(data.map((entry) => entry.key)).size, 3);
  assert.ok(data.every((entry) => entry.label.includes(":")));
});

test("ランクBは通常売価ではなく緑線用データへ分離する", () => {
  const [data] = aggregatePriceChartData(
    [
      {
        checkedAt: "2026-08-05T09:00:00.000Z",
        salePrice: 20800,
        buyPrice: 15000,
        condition: "テクニカルマニュアル欠品",
        conditionRank: "B",
      },
    ],
    "day",
  );

  assert.equal(data.salePrice, null);
  assert.equal(data.rankBPrice, 20800);
  assert.equal(data.conditionRank, "B");
});

test("タイムセールは元価格を通常線に残して黄色線へ分岐する", () => {
  const [data] = aggregatePriceChartData(
    [
      {
        checkedAt: "2026-08-05T12:00:00.000Z",
        salePrice: 5400,
        regularSalePrice: 6000,
        buyPrice: 2000,
        isTimeSale: true,
      },
    ],
    "day",
  );

  assert.equal(data.salePrice, 6000);
  assert.equal(data.timeSaleBasePrice, 6000);
  assert.equal(data.timeSalePrice, 5400);
});

test("ランクBのタイムセールも緑の元価格から黄色へ分岐する", () => {
  const [data] = aggregatePriceChartData(
    [
      {
        checkedAt: "2026-08-05T12:00:00.000Z",
        salePrice: 18000,
        regularSalePrice: 20800,
        buyPrice: 15000,
        conditionRank: "B",
        condition: "テクニカルマニュアル欠品",
        isTimeSale: true,
      },
    ],
    "day",
  );

  assert.equal(data.salePrice, null);
  assert.equal(data.rankBPrice, 20800);
  assert.equal(data.timeSaleBasePrice, 20800);
  assert.equal(data.timeSalePrice, 18000);
});

test("週表示は月曜始まりの週ごとの最新値にまとめる", () => {
  const data = aggregatePriceChartData(
    [
      point("2026-08-03T08:00:00.000Z", 1000),
      point("2026-08-09T18:00:00.000Z", 1200),
      point("2026-08-10T08:00:00.000Z", 1400),
    ],
    "week",
  );

  assert.deepEqual(data.map((entry) => entry.salePrice), [1200, 1400]);
});

test("月表示は各月の最新値を残す", () => {
  const data = aggregatePriceChartData(
    [
      point("2026-06-01T08:00:00.000Z", 1000),
      point("2026-06-30T18:00:00.000Z", 1200),
      point("2026-07-15T08:00:00.000Z", 1400),
    ],
    "month",
  );

  assert.deepEqual(data.map((entry) => entry.salePrice), [1200, 1400]);
});
