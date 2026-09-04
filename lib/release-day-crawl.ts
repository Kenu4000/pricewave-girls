const JST_OFFSET_MS = 9 * 60 * 60 * 1_000;

export type ReleaseDayCrawlProduct = {
  id: number;
  releaseDate: string | null;
  createdAt: Date | string;
  crawlIntervalDays: number | null;
  releaseCrawlPromotedAt: Date | string | null;
};

export type ReleaseDayCrawlDecision = {
  shouldMarkHandled: boolean;
  shouldSetDaily: boolean;
};

export function normalizeReleaseDateKey(value: string | null | undefined): string | null {
  const source = String(value ?? "").normalize("NFKC").trim();
  const match = source.match(
    /(\d{4})\s*(?:[\/.-]|年)\s*(\d{1,2})\s*(?:[\/.-]|月)\s*(\d{1,2})\s*日?/u,
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function japanDateKey(value: Date | string | number): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function releaseDayCrawlDecision(
  product: ReleaseDayCrawlProduct,
  now: Date = new Date(),
): ReleaseDayCrawlDecision {
  if (product.releaseCrawlPromotedAt) {
    return { shouldMarkHandled: false, shouldSetDaily: false };
  }

  const releaseDate = normalizeReleaseDateKey(product.releaseDate);
  const today = japanDateKey(now);
  const createdDate = japanDateKey(product.createdAt);
  if (!releaseDate || !today || !createdDate) {
    return { shouldMarkHandled: false, shouldSetDaily: false };
  }

  // 発売前から（または発売日当日に）登録されていたカードだけを対象にする。
  // 過去作品を発売後に新規登録したケースまで一律1日に戻さない。
  if (releaseDate > today || createdDate > releaseDate) {
    return { shouldMarkHandled: false, shouldSetDaily: false };
  }

  return {
    shouldMarkHandled: true,
    shouldSetDaily: product.crawlIntervalDays !== 1,
  };
}

export function isReleaseDateTodayInJapan(
  releaseDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const releaseDateKey = normalizeReleaseDateKey(releaseDate);
  const today = japanDateKey(now);
  return releaseDateKey !== null && today !== null && releaseDateKey === today;
}
