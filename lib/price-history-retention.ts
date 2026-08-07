import { prisma } from "@/lib/prisma";

export type PriceHistorySnapshot = {
  id: number;
  salePrice: number | null;
  regularSalePrice?: number | null;
  buyPrice: number | null;
  stockStatus: string | null;
  condition?: string | null;
  conditionRank?: string | null;
  isTimeSale: boolean;
  checkedAt: Date | string;
};

export const PRICE_HISTORY_RECENT_LIMIT = 10;
const DELETE_CHUNK_SIZE = 500;
const JAPAN_STANDARD_TIME_OFFSET_MS = 9 * 60 * 60 * 1_000;

function sameSnapshot(left: PriceHistorySnapshot, right: PriceHistorySnapshot): boolean {
  return (
    left.salePrice === right.salePrice &&
    (left.regularSalePrice ?? null) === (right.regularSalePrice ?? null) &&
    left.buyPrice === right.buyPrice &&
    left.stockStatus === right.stockStatus &&
    (left.condition ?? null) === (right.condition ?? null) &&
    (left.conditionRank ?? "A") === (right.conditionRank ?? "A") &&
    left.isTimeSale === right.isTimeSale
  );
}

function japanDateKey(value: Date | string): string {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) return "";
  return new Date(milliseconds + JAPAN_STANDARD_TIME_OFFSET_MS).toISOString().slice(0, 10);
}

function sameCheckedDate(left: PriceHistorySnapshot, right: PriceHistorySnapshot): boolean {
  const leftDate = japanDateKey(left.checkedAt);
  return leftDate !== "" && leftDate === japanDateKey(right.checkedAt);
}

/**
 * Histories must be supplied newest first.
 *
 * The newest ten rows form the ordinary recent window. For older rows, only
 * an exact duplicate recorded on the same Japan-calendar date as the
 * immediately newer retained snapshot is removable. A different date, price,
 * state rank, regular price, stock, or time-sale state is always retained.
 */
export function priceHistoryIdsToDelete(
  histories: PriceHistorySnapshot[],
  recentLimit = PRICE_HISTORY_RECENT_LIMIT,
): number[] {
  if (recentLimit < 1 || histories.length <= recentLimit) return [];

  const retained: PriceHistorySnapshot[] = histories.slice(0, recentLimit);
  const deletions: number[] = [];

  for (const history of histories.slice(recentLimit)) {
    const immediatelyNewer = retained.at(-1);
    if (
      immediatelyNewer &&
      sameCheckedDate(immediatelyNewer, history) &&
      sameSnapshot(immediatelyNewer, history)
    ) {
      deletions.push(history.id);
      continue;
    }

    retained.push(history);
  }

  return deletions;
}

export async function pruneProductPriceHistories(productIds: number[]): Promise<number> {
  const uniqueProductIds = [...new Set(productIds)];
  if (uniqueProductIds.length === 0) return 0;

  const histories = await prisma.priceHistory.findMany({
    where: { productId: { in: uniqueProductIds } },
    orderBy: [{ productId: "asc" }, { checkedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      productId: true,
      salePrice: true,
      regularSalePrice: true,
      buyPrice: true,
      stockStatus: true,
      condition: true,
      conditionRank: true,
      isTimeSale: true,
      checkedAt: true,
    },
  });

  const historiesByProduct = new Map<number, PriceHistorySnapshot[]>();
  for (const history of histories) {
    const productHistories = historiesByProduct.get(history.productId) ?? [];
    productHistories.push(history);
    historiesByProduct.set(history.productId, productHistories);
  }

  const ids = [...historiesByProduct.values()].flatMap((productHistories) =>
    priceHistoryIdsToDelete(productHistories),
  );
  let deletedCount = 0;

  for (let start = 0; start < ids.length; start += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + DELETE_CHUNK_SIZE);
    const result = await prisma.priceHistory.deleteMany({ where: { id: { in: chunk } } });
    deletedCount += result.count;
  }

  return deletedCount;
}
