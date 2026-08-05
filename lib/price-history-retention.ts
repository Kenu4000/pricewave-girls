import { prisma } from "@/lib/prisma";

export type PriceHistorySnapshot = {
  id: number;
  salePrice: number | null;
  buyPrice: number | null;
  stockStatus: string | null;
  isTimeSale: boolean;
};

export const PRICE_HISTORY_RECENT_LIMIT = 10;
const DELETE_CHUNK_SIZE = 500;

function sameSnapshot(left: PriceHistorySnapshot, right: PriceHistorySnapshot): boolean {
  return (
    left.salePrice === right.salePrice &&
    left.buyPrice === right.buyPrice &&
    left.stockStatus === right.stockStatus &&
    left.isTimeSale === right.isTimeSale
  );
}

/**
 * Histories must be supplied newest first.
 *
 * The newest ten rows form the ordinary recent window. For older rows, an
 * exact duplicate of the immediately newer retained snapshot is removable.
 * A different snapshot is protected as a change point and does not consume
 * the ten-row recent window.
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
    if (immediatelyNewer && sameSnapshot(immediatelyNewer, history)) {
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
      buyPrice: true,
      stockStatus: true,
      isTimeSale: true,
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
