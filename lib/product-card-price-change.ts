export type ProductCardPriceChangeKind = "sale" | "buy";

export type ProductCardPriceChange = {
  type: ProductCardPriceChangeKind;
  previousPrice: number | null;
  currentPrice: number | null;
  changedAt: string;
};

export type ProductCardPriceChangeSummary = {
  sale?: ProductCardPriceChange;
  buy?: ProductCardPriceChange;
};

export type ProductCardPriceChangeSummaries = Record<
  number,
  ProductCardPriceChangeSummary
>;

type PriceChangeRow = {
  productId: number;
  type: string;
  previousPrice: number | null;
  currentPrice: number | null;
  changedAt: Date | string;
};

export function buildProductCardPriceChangeSummaries(
  rows: PriceChangeRow[],
): ProductCardPriceChangeSummaries {
  const summaries: ProductCardPriceChangeSummaries = {};

  for (const row of rows) {
    if (row.type !== "sale" && row.type !== "buy") continue;
    const summary = (summaries[row.productId] ??= {});
    if (summary[row.type]) continue;

    summary[row.type] = {
      type: row.type,
      previousPrice: row.previousPrice,
      currentPrice: row.currentPrice,
      changedAt:
        row.changedAt instanceof Date ? row.changedAt.toISOString() : row.changedAt,
    };
  }

  return summaries;
}

export type PriceChangeDirection = "up" | "down" | "changed";

export function productCardPriceChangeDirection(
  change: ProductCardPriceChange,
): PriceChangeDirection {
  if (change.previousPrice == null || change.currentPrice == null) return "changed";
  if (change.currentPrice > change.previousPrice) return "up";
  if (change.currentPrice < change.previousPrice) return "down";
  return "changed";
}

function localDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

export function formatPriceChangeAge(
  changedAt: string,
  now = new Date(),
): string {
  const changed = new Date(changedAt);
  if (Number.isNaN(changed.getTime())) return "日時不明";

  const days = localDayNumber(now) - localDayNumber(changed);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days > 1) return `${days}日前`;
  return changed.toLocaleDateString("ja-JP");
}

export function formatProductCardPriceChange(
  change: ProductCardPriceChange,
  now = new Date(),
): string {
  const label = change.type === "sale" ? "売価" : "買取";
  const direction = productCardPriceChangeDirection(change);
  const age = formatPriceChangeAge(change.changedAt, now);

  if (
    direction === "changed" ||
    change.previousPrice == null ||
    change.currentPrice == null
  ) {
    return `${label} 変更・${age}`;
  }

  const difference = change.currentPrice - change.previousPrice;
  const arrow = direction === "up" ? "↑" : "↓";
  const signedDifference = difference > 0
    ? `+${difference.toLocaleString("ja-JP")}円`
    : `${difference.toLocaleString("ja-JP")}円`;
  return `${label} ${arrow} ${signedDifference}・${age}`;
}
