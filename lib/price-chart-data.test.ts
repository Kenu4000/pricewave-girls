import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePriceChartData, type PriceChartHistory } from "./price-chart-data";

function point(checkedAt: string, salePrice: number): PriceChartHistory {
  return { checkedAt, salePrice, buyPrice: Math.floor(salePrice / 2) };
}

test("日表示は直近31日の全取得時点を残す", () => {
  const data = aggregatePriceChartData(
    [
      point("2026-06-30T12:00:00.000Z", 1000),
      point("2026-07-10T09:00:00.000Z", 2000),
      point("2026-07-10T18:00:00.000Z", 2200),
      point("2026-08-05T12:00:00.000Z", 3000),
    ],
    "day",
  );

  assert.deepEqual(data.map((entry) => entry.salePrice), [2000, 2200, 3000]);
  assert.deepEqual(data.map((entry) => entry.checkedAt), [
    "2026-07-10T09:00:00.000Z",
    "2026-07-10T18:00:00.000Z",
    "2026-08-05T12:00:00.000Z",
  ]);
  assert.match(data[0].label, /09:00|9:00/u);
  assert.match(data[1].label, /18:00/u);
  assert.doesNotMatch(data[2].label, /:/u);
});

test("同日中の通常価格からタイムセールを経て通常価格へ戻る変化を残す", () => {
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
