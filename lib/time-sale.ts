import * as cheerio from "cheerio";
import type { FetchedProduct } from "./surugaya";

export const TIME_SALE_DETAIL_KEY = "__pricewaveTimeSale";

export function detectPrimaryTimeSale(html: string): boolean {
  const $ = cheerio.load(html);
  const bodyText = normalizeText($("body").text());
  const primarySection = bodyText.split("その他の状態を選ぶ", 1)[0] ?? bodyText;
  const saleBlocks = primarySection.matchAll(
    /(?:中古|新品|予約)(.{0,320}?)(?:\(税込\)|（税込）)/gu,
  );

  for (const match of saleBlocks) {
    const block = normalizeText(match[1]);
    if (/他のショップ|送料|手数料/u.test(block)) continue;
    if (/(?:※\s*)?タイム\s*セール/iu.test(block)) return true;
  }

  return false;
}

export function withTimeSaleStorageMarker(
  fetched: FetchedProduct,
  isTimeSale: boolean,
): FetchedProduct {
  return {
    ...fetched,
    details: {
      ...fetched.details,
      [TIME_SALE_DETAIL_KEY]: isTimeSale ? "true" : "false",
    },
  };
}

export function timeSaleStateFromFetched(fetched: FetchedProduct): boolean {
  return fetched.details[TIME_SALE_DETAIL_KEY] === "true";
}

export function isInternalProductDetailLabel(label: string): boolean {
  return label === TIME_SALE_DETAIL_KEY;
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
