export type DisplayPriceHistory = {
  salePrice: number | null;
  regularSalePrice?: number | null;
  buyPrice: number | null;
};

export const PRICE_HISTORY_RECENT_DISPLAY_LIMIT = 10;

function hasDifferentPrice(left: DisplayPriceHistory, right: DisplayPriceHistory): boolean {
  return (
    left.salePrice !== right.salePrice ||
    (left.regularSalePrice ?? null) !== (right.regularSalePrice ?? null) ||
    left.buyPrice !== right.buyPrice
  );
}

/**
 * Histories must be supplied newest first.
 *
 * The newest ten rows are always shown. Older rows are shown only when one of
 * the recorded prices differs from the immediately newer snapshot. This keeps
 * the table compact without deleting any stored history.
 */
export function selectDisplayedPriceHistories<T extends DisplayPriceHistory>(
  histories: T[],
  recentLimit = PRICE_HISTORY_RECENT_DISPLAY_LIMIT,
): T[] {
  if (histories.length === 0) return [];
  if (recentLimit < 1) return histories.filter((history, index) => {
    const newer = histories[index - 1];
    return !newer || hasDifferentPrice(history, newer);
  });
  if (histories.length <= recentLimit) return [...histories];

  const displayed = histories.slice(0, recentLimit);
  for (let index = recentLimit; index < histories.length; index += 1) {
    const history = histories[index];
    const immediatelyNewer = histories[index - 1];
    if (immediatelyNewer && hasDifferentPrice(history, immediatelyNewer)) {
      displayed.push(history);
    }
  }

  return displayed;
}
