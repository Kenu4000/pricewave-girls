export type InterestPriceChange = {
  type: string;
  previousPrice: number | null;
  currentPrice: number | null;
  changedAt: Date | string;
};

export type ProductInterestCandidate = {
  id: number;
  title?: string | null;
  priceChanges: InterestPriceChange[];
};

export type ProductInterestScore = {
  score: number;
  rangeRatio: number;
  changeCount: number;
  reversalCount: number;
  latestChangedAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_RATIO_CAP = 2;
const CHANGE_COUNT_CAP = 12;
const REVERSAL_COUNT_CAP = 6;
const RECENCY_DAYS = 30;

function validChanges(changes: InterestPriceChange[], type: "sale" | "buy") {
  return changes
    .filter(
      (change) =>
        change.type === type &&
        change.previousPrice !== null &&
        change.currentPrice !== null &&
        change.previousPrice > 0 &&
        change.currentPrice > 0 &&
        change.previousPrice !== change.currentPrice,
    )
    .sort(
      (left, right) =>
        new Date(left.changedAt).getTime() - new Date(right.changedAt).getTime(),
    );
}

function seriesMetrics(changes: InterestPriceChange[], type: "sale" | "buy") {
  const series = validChanges(changes, type);
  if (series.length === 0) {
    return { rangeRatio: 0, changeCount: 0, reversalCount: 0, latestChangedAt: 0 };
  }

  const values: number[] = [];
  const directions: number[] = [];
  let latestChangedAt = 0;

  for (const change of series) {
    values.push(change.previousPrice as number, change.currentPrice as number);
    directions.push(Math.sign((change.currentPrice as number) - (change.previousPrice as number)));
    latestChangedAt = Math.max(latestChangedAt, new Date(change.changedAt).getTime());
  }

  const minPrice = Math.min(...values);
  const maxPrice = Math.max(...values);
  const rangeRatio = minPrice > 0 ? (maxPrice - minPrice) / minPrice : 0;
  let reversalCount = 0;
  for (let index = 1; index < directions.length; index += 1) {
    if (directions[index] !== directions[index - 1]) reversalCount += 1;
  }

  return {
    rangeRatio,
    changeCount: directions.length,
    reversalCount,
    latestChangedAt,
  };
}

export function productInterestScore(
  changes: InterestPriceChange[],
  now: Date = new Date(),
): ProductInterestScore {
  const sale = seriesMetrics(changes, "sale");
  const buy = seriesMetrics(changes, "buy");
  const rangeRatio = Math.max(sale.rangeRatio, buy.rangeRatio);
  const changeCount = sale.changeCount + buy.changeCount;
  const reversalCount = sale.reversalCount + buy.reversalCount;
  const latestChangedAt = Math.max(sale.latestChangedAt, buy.latestChangedAt);

  if (changeCount === 0 || latestChangedAt === 0) {
    return { score: 0, rangeRatio: 0, changeCount: 0, reversalCount: 0, latestChangedAt: 0 };
  }

  const ageDays = Math.max(0, (now.getTime() - latestChangedAt) / DAY_MS);
  const rangePoints = Math.min(rangeRatio, RANGE_RATIO_CAP) * 40;
  const changePoints = Math.min(changeCount, CHANGE_COUNT_CAP) * 3;
  const reversalPoints = Math.min(reversalCount, REVERSAL_COUNT_CAP) * 8;
  const recencyPoints = Math.max(0, 1 - ageDays / RECENCY_DAYS) * 20;

  return {
    score: rangePoints + changePoints + reversalPoints + recencyPoints,
    rangeRatio,
    changeCount,
    reversalCount,
    latestChangedAt,
  };
}

export function sortProductsByInterest<T extends ProductInterestCandidate>(
  products: T[],
  now: Date = new Date(),
): T[] {
  const scored = products.map((product) => ({
    product,
    interest: productInterestScore(product.priceChanges, now),
  }));

  return scored
    .sort(
      (left, right) =>
        right.interest.score - left.interest.score ||
        right.interest.latestChangedAt - left.interest.latestChangedAt ||
        String(left.product.title ?? "").localeCompare(String(right.product.title ?? ""), "ja") ||
        left.product.id - right.product.id,
    )
    .map(({ product }) => product);
}
