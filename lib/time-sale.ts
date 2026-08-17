import * as cheerio from "cheerio";
import {
  isInternalProductConditionDetailLabel,
  PRODUCT_CONDITION_DETAIL_KEY,
  PRODUCT_CONDITION_RANK_DETAIL_KEY,
  productConditionFromDetails,
  splitProductTitleCondition,
} from "./product-title-condition";
import { normalizePrice, type FetchedProduct } from "./surugaya";
import { detectTimeSaleEndAt } from "./time-sale-end";

export const TIME_SALE_DETAIL_KEY = "__pricewaveTimeSale";
export const TIME_SALE_REGULAR_PRICE_DETAIL_KEY = "__pricewaveRegularSalePrice";
export const TIME_SALE_END_AT_DETAIL_KEY = "__pricewaveTimeSaleEndsAt";

const TIME_SALE_PATTERN = /(?:※\s*)?タイム\s*セール/iu;
const TIME_SALE_IMAGE_PATTERN = /タイム\s*セール|time[_-]?sale|flash[_-]?sale/iu;
const PRIMARY_RANK_B_PATTERN = /(?:【\s*)?ランク\s*B(?:\s*】|\s*[)）])?/iu;

export function detectPrimaryTimeSale(html: string): boolean {
  const section = primarySaleSection(html);
  return (
    TIME_SALE_PATTERN.test(section.text) ||
    section.hasTimeSaleImage ||
    section.blocks.some((block) => TIME_SALE_PATTERN.test(block))
  );
}

export function detectPrimaryTimeSaleRegularPrice(html: string): number | null {
  const section = primarySaleSection(html);
  const explicitSaleBlock = section.blocks.find((block) => TIME_SALE_PATTERN.test(block));
  if (explicitSaleBlock) return regularPriceFromSaleBlock(explicitSaleBlock);

  if (!TIME_SALE_PATTERN.test(section.text) && !section.hasTimeSaleImage) return null;

  for (const block of section.blocks) {
    const regularPrice = regularPriceFromSaleBlock(block);
    if (regularPrice !== null) return regularPrice;
  }

  return null;
}

export function detectPrimaryProductCondition(html: string): {
  condition: string | null;
  conditionRank: "A" | "B";
} {
  const section = primarySaleSection(html);
  const rankBBlock = section.blocks.find((block) => PRIMARY_RANK_B_PATTERN.test(block));
  if (rankBBlock) {
    return { condition: "ランクB", conditionRank: "B" };
  }
  return { condition: null, conditionRank: "A" };
}

export function withProductStateStorageMarkers(
  html: string,
  fetched: FetchedProduct,
): FetchedProduct {
  const titleState = splitProductTitleCondition(fetched.title);
  const primaryConditionState = detectPrimaryProductCondition(html);
  const conditionState =
    titleState.conditionRank === "B" ? titleState : primaryConditionState;
  const isTimeSale = detectPrimaryTimeSale(html);
  const regularSalePrice = isTimeSale ? detectPrimaryTimeSaleRegularPrice(html) : null;
  const timeSaleEndsAt = isTimeSale ? detectTimeSaleEndAt(html) : null;
  const details = { ...fetched.details };

  delete details[PRODUCT_CONDITION_DETAIL_KEY];
  delete details[PRODUCT_CONDITION_RANK_DETAIL_KEY];
  delete details[TIME_SALE_REGULAR_PRICE_DETAIL_KEY];
  delete details[TIME_SALE_END_AT_DETAIL_KEY];

  if (conditionState.condition) {
    details[PRODUCT_CONDITION_DETAIL_KEY] = conditionState.condition;
    details[PRODUCT_CONDITION_RANK_DETAIL_KEY] = conditionState.conditionRank;
  }
  if (regularSalePrice !== null) {
    details[TIME_SALE_REGULAR_PRICE_DETAIL_KEY] = String(regularSalePrice);
  }
  if (timeSaleEndsAt !== null) {
    details[TIME_SALE_END_AT_DETAIL_KEY] = timeSaleEndsAt.toISOString();
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

export function timeSaleEndAtFromFetched(
  fetched: FetchedProduct,
  isTimeSale = timeSaleStateFromFetched(fetched),
): Date | null {
  if (!isTimeSale) return null;
  const stored = fetched.details[TIME_SALE_END_AT_DETAIL_KEY];
  if (!stored) return null;
  const date = new Date(stored);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function productConditionStateFromFetched(fetched: FetchedProduct) {
  return productConditionFromDetails(fetched.details);
}

export function isInternalProductDetailLabel(label: string): boolean {
  return (
    label === TIME_SALE_DETAIL_KEY ||
    label === TIME_SALE_REGULAR_PRICE_DETAIL_KEY ||
    label === TIME_SALE_END_AT_DETAIL_KEY ||
    isInternalProductConditionDetailLabel(label)
  );
}

type PrimarySaleSection = {
  text: string;
  blocks: string[];
  hasTimeSaleImage: boolean;
};

function primarySaleSection(html: string): PrimarySaleSection {
  const primaryHtml = html.split("その他の状態を選ぶ", 1)[0] ?? html;
  const $ = cheerio.load(primaryHtml);
  const body = $("body");
  const text = normalizeText(body.text());
  const blocks: string[] = [];
  const saleBlocks = text.matchAll(
    /(?:中古|新品|予約)(.{0,320}?)(?:\(税込\)|（税込）)/gu,
  );

  for (const match of saleBlocks) {
    const block = normalizeText(match[1]);
    if (/他のショップ|送料|手数料/u.test(block)) continue;
    blocks.push(block);
  }

  let hasTimeSaleImage = false;
  body.find("img").each((_, image) => {
    if (hasTimeSaleImage) return;
    const label = normalizeText(
      [$(image).attr("alt"), $(image).attr("title"), $(image).attr("src")]
        .filter(Boolean)
        .join(" "),
    );
    if (TIME_SALE_IMAGE_PATTERN.test(label)) hasTimeSaleImage = true;
  });

  return { text, blocks, hasTimeSaleImage };
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
