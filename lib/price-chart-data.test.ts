import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePriceChartData, type PriceChartHistory } from "./price-chart-data";

function point(checkedAt: string, salePrice: number): PriceChartHistory {
  return { checkedAt, salePrice, buyPrice: Math.floor(salePrice / 2) };
}

test("日表示は直近31日だけを日ごとの最新値にまとめる", () => {
  const data = aggregatePriceChartData(
    [
      point("2026-06-30T12:00:00.000Z", 1000),
      point("2026-07-10T09:00:00.000Z", 2000),
      point("2026-07-10T18:00:00.000Z", 2200),
      point("2026-08-05T12:00:00.000Z", 3000),
    ],
    "day",
  );

  assert.deepEqual(data.map((entry) => entry.salePrice), [2200, 3000]);
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
