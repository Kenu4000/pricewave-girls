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

const TIME_SALE_PATTERN = /(?:※\s*)?タイム\s*セール/iu;

export function detectPrimaryTimeSale(html: string): boolean {
  const section = primarySaleSection(html);
  if (TIME_SALE_PATTERN.test(section.text)) return true;
  if (section.hasTimeSaleImage) return true;
  return section.blocks.some((block) => TIME_SALE_PATTERN.test(block));
}

export function detectPrimaryTimeSaleRegularPrice(html: string): number | null {
  const section = primarySaleSection(html);
  const explicitSaleBlock = section.blocks.find((block) => TIME_SALE_PATTERN.test(block));
  if (explicitSaleBlock) return regularPriceFromSaleBlock(explicitSaleBlock);

  if (!TIME_SALE_PATTERN.test(section.text) && !section.hasTimeSaleImage) return null;

  // Current Surugaya pages can render the time-sale badge immediately before the
  // price block instead of inside it. In that layout, the discounted block is
  // identifiable by having both the regular and current prices.
  for (const block of section.blocks) {
    const regularPrice = regularPriceFromSaleBlock(block);
    if (regularPrice !== null) return regularPrice;
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

type PrimarySaleSection = {
  text: string;
  blocks: string[];
  hasTimeSaleImage: boolean;
};

function primarySaleSection(html: string): PrimarySaleSection {
  const $ = cheerio.load(html);
  const body = $("body");
  const marker = body.find("*:contains('その他の状態を選ぶ')").filter((_, element) => {
    return normalizeText($(element).clone().children().remove().end().text()) === "その他の状態を選ぶ";
  }).first();

  // Keep the historical text split as the primary guard against alternate-
  // condition sales. Image alt/title attributes are checked separately because
  // Cheerio .text() does not include them.
  const bodyText = normalizeText(body.text());
  const text = bodyText.split("その他の状態を選ぶ", 1)[0] ?? bodyText;
  const blocks: string[] = [];
  const saleBlocks = text.matchAll(
    /(?:中古|新品|予約)(.{0,320}?)(?:\(税込\)|（税込）)/gu,
  );

  for (const match of saleBlocks) {
    const block = normalizeText(match[1]);
    if (/他のショップ|送料|手数料/u.test(block)) continue;
    blocks.push(block);
  }

  const markerElement = marker.get(0);
  let hasTimeSaleImage = false;
  body.find("img").each((_, image) => {
    if (hasTimeSaleImage) return;
    if (markerElement && comesAfter(image, markerElement)) return;
    const label = normalizeText(
      [$(image).attr("alt"), $(image).attr("title"), $(image).attr("src")]
        .filter(Boolean)
        .join(" "),
    );
    if (/タイム\s*セール|time[_-]?sale|flash[_-]?sale/iu.test(label)) {
      hasTimeSaleImage = true;
    }
  });

  return { text, blocks, hasTimeSaleImage };
}

function comesAfter(node: any, reference: any): boolean {
  if (node === reference) return false;
  const position = node.compareDocumentPosition?.(reference);
  // Node.DOCUMENT_POSITION_PRECEDING = 2 means reference precedes node.
  return typeof position === "number" && Boolean(position & 2);
}

function regularPriceFromSaleBlock(block: string): number | null {
  const prices = [...block.matchAll(/[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/gu)]
    .map((match) => normalizePrice(match[0]))
    .filter((price): price is number => price !== null);
  const currentPrice = prices.at(-1);
  if (currentPrice === undefined) return null;

  return (
    prices
      .slice(0, -1)
      .reverse()
      .find((price) => price !== currentPrice) ?? null
  );
}

function normalizeText(value: string): string {
  return value.replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}
