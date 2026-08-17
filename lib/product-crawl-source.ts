import * as cheerio from "cheerio";
import {
  PRODUCT_CONDITION_DETAIL_KEY,
  PRODUCT_CONDITION_RANK_DETAIL_KEY,
} from "./product-title-condition";
import { normalizePrice, normalizeSurugayaUrl, type FetchedProduct } from "./surugaya";

export const PRODUCT_CRAWL_SOURCE_DETAIL_KEY = "__pricewaveCrawlSourceUrl";

const CRAWL_SOURCE_QUERY_KEYS = ["tenpo_cd", "branch_number"] as const;
const OTHER_SHOPS_DATA_ID = "pricewave-other-shops-data";

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

export function resolveProductCrawlSourceUrl(
  rawSourceUrl: string,
  productHtml: string,
): string {
  const normalized = normalizeSurugayaCrawlSourceUrl(rawSourceUrl);
  const source = new URL(normalized);
  const tenpoCd = source.searchParams.get("tenpo_cd");
  const branchNumber = source.searchParams.get("branch_number");
  if (!tenpoCd || branchNumber) return normalized;

  const otherShopsHtml = embeddedOtherShopsHtml(productHtml);
  if (!otherShopsHtml) return normalized;

  const matchingUrls = matchingOfferUrls(otherShopsHtml, source);
  return matchingUrls[0] ?? normalized;
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

export function applySelectedCrawlSourceOffer(
  fetched: FetchedProduct,
  sourceUrl: string | null,
  productHtml: string,
): FetchedProduct {
  if (!sourceUrl) return fetched;
  const source = new URL(normalizeSurugayaCrawlSourceUrl(sourceUrl));
  if (!source.searchParams.get("tenpo_cd") || !source.searchParams.get("branch_number")) {
    return fetched;
  }

  const otherShopsHtml = embeddedOtherShopsHtml(productHtml);
  if (!otherShopsHtml) return fetched;
  const offer = selectedOffer(otherShopsHtml, source);
  if (!offer) return fetched;

  const details = { ...fetched.details };
  delete details[PRODUCT_CONDITION_DETAIL_KEY];
  delete details[PRODUCT_CONDITION_RANK_DETAIL_KEY];
  if (offer.conditionRank === "B") {
    details[PRODUCT_CONDITION_DETAIL_KEY] = offer.condition;
    details[PRODUCT_CONDITION_RANK_DETAIL_KEY] = "B";
  }

  return {
    ...fetched,
    salePrice: offer.price,
    stockStatus: "in_stock",
    details,
  };
}

type SelectedOffer = {
  price: number;
  condition: string;
  conditionRank: "A" | "B";
};

function embeddedOtherShopsHtml(productHtml: string): string {
  if (!productHtml.trim()) return "";
  const $ = cheerio.load(productHtml);
  return $("#" + OTHER_SHOPS_DATA_ID).first().text().trim();
}

function matchingOfferUrls(otherShopsHtml: string, source: URL): string[] {
  const $ = cheerio.load(otherShopsHtml);
  const expectedPath = source.pathname;
  const tenpoCd = source.searchParams.get("tenpo_cd");
  const urls = new Set<string>();

  $("a[href]").each((_, anchor) => {
    try {
      const candidate = new URL($(anchor).attr("href") ?? "", "https://www.suruga-ya.jp");
      if (candidate.pathname !== expectedPath) return;
      if (candidate.searchParams.get("tenpo_cd") !== tenpoCd) return;
      if (!candidate.searchParams.get("branch_number")) return;
      urls.add(normalizeSurugayaCrawlSourceUrl(candidate.toString()));
    } catch {
      // 壊れたリンクは無視する。
    }
  });

  return [...urls];
}

function selectedOffer(otherShopsHtml: string, source: URL): SelectedOffer | null {
  const $ = cheerio.load(otherShopsHtml);
  const sourceKey = offerKey(source);
  let matchedRow: cheerio.Cheerio<any> | null = null;
  let matchedConditionText = "";

  $("a[href]").each((_, anchor) => {
    if (matchedRow) return;
    try {
      const candidate = new URL($(anchor).attr("href") ?? "", "https://www.suruga-ya.jp");
      if (offerKey(candidate) !== sourceKey) return;
      const row = $(anchor).closest("tr");
      if (row.length === 0) return;
      matchedRow = row;
      matchedConditionText = normalizeText($(anchor).text());
    } catch {
      // 壊れたリンクは無視する。
    }
  });

  if (!matchedRow) return null;
  const row = matchedRow as cheerio.Cheerio<any>;
  const rowText = normalizeText(row.text());
  const priceMatches = [...rowText.matchAll(/[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/gu)];
  const price = priceMatches
    .map((match) => normalizePrice(match[0]))
    .find((value): value is number => value !== null);
  if (price === undefined) return null;

  if (!/^(?:中古|新品|予約)/u.test(matchedConditionText)) {
    const cells = row
      .children("th, td")
      .toArray()
      .map((cell) => normalizeText($(cell).text()));
    matchedConditionText = cells.find((cell) => /^(?:中古|新品|予約)/u.test(cell)) ?? "";
  }

  const condition = matchedConditionText.replace(/^(?:中古|新品|予約)\s*/u, "").trim();
  return {
    price,
    condition: condition || "通常",
    conditionRank: condition ? "B" : "A",
  };
}

function offerKey(url: URL): string {
  return [
    url.pathname,
    url.searchParams.get("tenpo_cd") ?? "",
    url.searchParams.get("branch_number") ?? "",
  ].join("|");
}

function normalizeText(value: string): string {
  return value.replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}
