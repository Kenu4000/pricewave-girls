export const CRAWL_INTERVAL_OPTIONS = [1, 3, 7, 14] as const;
export type CrawlIntervalDays = (typeof CRAWL_INTERVAL_OPTIONS)[number] | null;

export function parseCrawlIntervalDays(value: unknown): CrawlIntervalDays | undefined {
  if (value === null) return null;
  const number = Number(value);
  return CRAWL_INTERVAL_OPTIONS.includes(number as Exclude<CrawlIntervalDays, null>)
    ? (number as Exclude<CrawlIntervalDays, null>)
    : undefined;
}

export function isCrawlDue(
  crawlIntervalDays: number | null | undefined,
  lastCheckedAt: Date | string | null | undefined,
  now: Date | number = new Date(),
): boolean {
  const interval = parseCrawlIntervalDays(crawlIntervalDays ?? null);
  if (interval === null || interval === undefined) return false;
  if (!lastCheckedAt) return true;

  const checkedAt = lastCheckedAt instanceof Date ? lastCheckedAt.getTime() : Date.parse(lastCheckedAt);
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(checkedAt) || !Number.isFinite(nowMs)) return true;
  return nowMs - checkedAt >= interval * 24 * 60 * 60 * 1_000;
}
