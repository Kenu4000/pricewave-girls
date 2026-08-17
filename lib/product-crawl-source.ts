import type { FetchedProduct } from "./surugaya";
import { normalizeSurugayaUrl } from "./surugaya";

export const PRODUCT_CRAWL_SOURCE_DETAIL_KEY = "__pricewaveCrawlSourceUrl";

const CRAWL_SOURCE_QUERY_KEYS = ["tenpo_cd", "branch_number"] as const;

export function normalizeSurugayaCrawlSourceUrl(rawUrl: string): string {
  const canonical = new URL(normalizeSurugayaUrl(rawUrl));
  const source = new URL(rawUrl);

  for (const key of CRAWL_SOURCE_QUERY_KEYS) {
    const value = source.searchParams.get(key)?.trim();
    if (value) canonical.searchParams.set(key, value);
  }

  return canonical.toString();
}

export function hasSurugayaCrawlSourceSelector(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return CRAWL_SOURCE_QUERY_KEYS.some((key) => Boolean(url.searchParams.get(key)?.trim()));
  } catch {
    return false;
  }
}

export function crawlSourceUrlFromDetailsJson(
  detailsJson: string | null | undefined,
): string | null {
  if (!detailsJson) return null;

  try {
    const parsed = JSON.parse(detailsJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = (parsed as Record<string, unknown>)[PRODUCT_CRAWL_SOURCE_DETAIL_KEY];
    if (typeof value !== "string" || !hasSurugayaCrawlSourceSelector(value)) return null;
    return normalizeSurugayaCrawlSourceUrl(value);
  } catch {
    return null;
  }
}

export function productCrawlUrl(
  surugayaUrl: string,
  detailsJson: string | null | undefined,
): string {
  return crawlSourceUrlFromDetailsJson(detailsJson) ?? surugayaUrl;
}

export function withProductCrawlSource(
  fetched: FetchedProduct,
  sourceUrl: string | null,
): FetchedProduct {
  if (!sourceUrl || !hasSurugayaCrawlSourceSelector(sourceUrl)) return fetched;

  return {
    ...fetched,
    details: {
      ...fetched.details,
      [PRODUCT_CRAWL_SOURCE_DETAIL_KEY]: normalizeSurugayaCrawlSourceUrl(sourceUrl),
    },
  };
}
