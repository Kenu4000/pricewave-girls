import * as cheerio from "cheerio";
import {
  isInternalProductConditionDetailLabel,
  PRODUCT_CONDITION_DETAIL_KEY,
  PRODUCT_CONDITION_RANK_DETAIL_KEY,
  productConditionFromDetails,
  splitProductTitleCondition,
} from "./product-title-condition";
import { normalizePrice, type FetchedProduct } from "./surugaya";

export const TIME_SALE_DETAIL_KEY = "__pricewaveTimeSale";
export const TIME_SALE_REGULAR_PRICE_DETAIL_KEY = "__pricewaveRegularSalePrice";

export function detectPrimaryTimeSale(html: string): boolean {
  return primarySaleBlocks(html).some((block) => /(?:※\s*)?タイム\s*セール/iu.test(block));
}

export function detectPrimaryTimeSaleRegularPrice(html: string): number | null {
  for (const block of primarySaleBlocks(html)) {
    if (!/(?:※\s*)?タイム\s*セール/iu.test(block)) continue;

    const prices = [...block.matchAll(/[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/gu)]
      .map((match) => normalizePrice(match[0]))
      .filter((price): price is number => price !== null);
    const currentPrice = prices.at(-1);
    if (currentPrice === undefined) continue;

    const regularPrice = prices
      .slice(0, -1)
      .reverse()
      .find((price) => price !== currentPrice);
    if (regularPrice !== undefined) return regularPrice;
  }

  return null;
}

export function withProductStateStorageMarkers(
  html: string,
  fetched: FetchedProduct,
): FetchedProduct {
  const titleState = splitProductTitleCondition(fetched.title);
  const isTimeSale = detectPrimaryTimeSale(html);
  const regularSalePrice = isTimeSale ? detectPrimaryTimeSaleRegularPrice(html) : null;
  const details = { ...fetched.details };

  delete details[PRODUCT_CONDITION_DETAIL_KEY];
  delete details[PRODUCT_CONDITION_RANK_DETAIL_KEY];
  delete details[TIME_SALE_REGULAR_PRICE_DETAIL_KEY];

  if (titleState.condition) {
    details[PRODUCT_CONDITION_DETAIL_KEY] = titleState.condition;
    details[PRODUCT_CONDITION_RANK_DETAIL_KEY] = titleState.conditionRank;
  }
  if (regularSalePrice !== null) {
    details[TIME_SALE_REGULAR_PRICE_DETAIL_KEY] = String(regularSalePrice);
  }

  return withTimeSaleStorageMarker(
    {
      ...fetched,
      title: titleState.title,
      details,
    },
    isTimeSale,
  );
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

export function regularSalePriceFromFetched(
  fetched: FetchedProduct,
  isTimeSale = timeSaleStateFromFetched(fetched),
): number | null {
  if (!isTimeSale) return fetched.salePrice;

  const stored = fetched.details[TIME_SALE_REGULAR_PRICE_DETAIL_KEY];
  if (!stored) return null;
  const value = Number(stored);
  return Number.isFinite(value) ? value : null;
}

export function productConditionStateFromFetched(fetched: FetchedProduct) {
  return productConditionFromDetails(fetched.details);
}

export function isInternalProductDetailLabel(label: string): boolean {
  return (
    label === TIME_SALE_DETAIL_KEY ||
    label === TIME_SALE_REGULAR_PRICE_DETAIL_KEY ||
    isInternalProductConditionDetailLabel(label)
  );
}

function primarySaleBlocks(html: string): string[] {
  const $ = cheerio.load(html);
  const bodyText = normalizeText($("body").text());
  const primarySection = bodyText.split("その他の状態を選ぶ", 1)[0] ?? bodyText;
  const blocks: string[] = [];
  const saleBlocks = primarySection.matchAll(
    /(?:中古|新品|予約)(.{0,320}?)(?:\(税込\)|（税込）)/gu,
  );

  for (const match of saleBlocks) {
    const block = normalizeText(match[1]);
    if (/他のショップ|送料|手数料/u.test(block)) continue;
    blocks.push(block);
  }

  return blocks;
}

function normalizeText(value: string): string {
  return value.replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}
