const JST_OFFSET_MS = 9 * 60 * 60 * 1_000;

// 機能導入前に発売済みの商品を一斉に1日へ戻さないための適用開始日。
// この日以降に発売日を迎える、発売前から登録済みのカードだけを自動昇格する。
export const RELEASE_CRAWL_AUTOMATION_START_DATE = "2026-09-04";

export type ReleaseDayCrawlProduct = {
  id: number;
  releaseDate: string | null;
  createdAt: Date | string;
  crawlIntervalDays: number | null;
  releaseCrawlPromotedForDate: string | null;
};

export type ReleaseDayCrawlDecision = {
  releaseDateKey: string | null;
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
  const releaseDateKey = normalizeReleaseDateKey(product.releaseDate);
  const today = japanDateKey(now);
  const createdDate = japanDateKey(product.createdAt);
  if (!releaseDateKey || !today || !createdDate) {
    return { releaseDateKey, shouldMarkHandled: false, shouldSetDaily: false };
  }

  if (product.releaseCrawlPromotedForDate === releaseDateKey) {
    return { releaseDateKey, shouldMarkHandled: false, shouldSetDaily: false };
  }

  if (releaseDateKey > today) {
    return { releaseDateKey, shouldMarkHandled: false, shouldSetDaily: false };
  }

  // 導入前に発売済みの商品は現在の手動設定を維持し、処理済みだけ記録する。
  if (releaseDateKey < RELEASE_CRAWL_AUTOMATION_START_DATE) {
    return { releaseDateKey, shouldMarkHandled: true, shouldSetDaily: false };
  }

  // 発売後に初めて登録した過去作品まで一律1日に戻さない。
  if (createdDate > releaseDateKey) {
    return { releaseDateKey, shouldMarkHandled: true, shouldSetDaily: false };
  }

  return {
    releaseDateKey,
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
