export const CRAWL_ROTATION_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1_000;

export function localCrawlDayNumber(value: Date | number = new Date()): number {
  const date = value instanceof Date ? value : new Date(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

export function crawlRotationBucket(value: Date | number = new Date()): number {
  const remainder = localCrawlDayNumber(value) % CRAWL_ROTATION_DAYS;
  return remainder < 0 ? remainder + CRAWL_ROTATION_DAYS : remainder;
}

export function productCrawlRotationBucket(productId: number): number {
  const normalizedId = Math.floor(Math.abs(Number(productId) || 0));
  return normalizedId % CRAWL_ROTATION_DAYS;
}
