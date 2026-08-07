export const SMALL_PRICE_CHANGE_THRESHOLD = 300;

export function isSmallPriceChange(
  previousPrice: number | null,
  currentPrice: number | null,
  threshold = SMALL_PRICE_CHANGE_THRESHOLD,
): boolean {
  if (previousPrice === null || currentPrice === null) return false;
  return Math.abs(currentPrice - previousPrice) <= threshold;
}
