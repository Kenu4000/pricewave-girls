import * as cheerio from "cheerio";
import type { FetchedJunkItem, FetchedProduct } from "./surugaya";
import { normalizePrice } from "./surugaya";

const CAPTURE_ELEMENT_ID = "pricewave-other-shops-data";
const CONDITION_PREFIX = /^(?:中古|新品|予約|プレミア|ワケアリ|ランク\s*B(?:[)）])?)/iu;
const CONDITION_IN_TEXT = /(?:^|\s)((?:中古|新品|予約|プレミア|ワケアリ|ランク\s*B(?:[)）])?).*?)(?=\s*[¥￥]?[0-9０-９][0-9０-９,，]*\s*円|$)/iu;
const YEN_PRICE = /[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/gu;

export function extractOtherShopItemsSafely(rawHtml: string): FetchedJunkItem[] {
  if (!rawHtml.trim()) return [];

  const $ = cheerio.load(rawHtml);
  const items: FetchedJunkItem[] = [];

  $("a[href]").each((_, anchor) => {
    const conditionAnchor = $(anchor);
    const condition = normalizeText(conditionAnchor.text());
    if (!looksLikeCondition(condition) || !isStoreOfferConditionLink(conditionAnchor.attr("href"))) {
      return;
    }

    const container = findOfferContainer($, conditionAnchor);
    if (!container) return;
    const storeName = sellerNameFromContainer($, container);
    const price = firstPrice(container.text());
    if (!storeName || price === null) return;

    items.push({
      sourceType: "other_shop",
      storeName,
      condition: cleanCondition(condition),
      price,
    });
  });

  // 実ページのレイアウト変更で状態リンク側から辿れない場合は、
  // 「〜の出品を見る」を起点に同じ出品ブロックを探す。
  $("a").each((_, anchor) => {
    const sellerAnchor = $(anchor);
    const sellerName = normalizeSellerName(sellerAnchor.text());
    if (!sellerName) return;

    const container = findOfferContainer($, sellerAnchor);
    if (!container) return;
    const price = firstPrice(container.text());
    if (price === null) return;

    const condition = conditionFromContainer($, container);
    if (!condition) return;

    items.push({
      sourceType: "other_shop",
      storeName: sellerName,
      condition,
      price,
    });
  });

  // 旧レイアウトのtable行にも対応するが、商品詳細表を誤認しないよう
  // 店舗出品を示すリンクが存在する行だけを対象にする。
  $("table tr").each((_, row) => {
    const rowElement = $(row);
    const storeName = sellerNameFromContainer($, rowElement);
    const conditionAnchor = rowElement
      .find("a[href]")
      .toArray()
      .map((candidate) => $(candidate))
      .find((candidate) => {
        const text = normalizeText(candidate.text());
        return looksLikeCondition(text) && isStoreOfferConditionLink(candidate.attr("href"));
      });
    if (!storeName && !conditionAnchor) return;

    const price = firstPrice(rowElement.text());
    if (price === null) return;
    const condition = conditionAnchor
      ? cleanCondition(conditionAnchor.text())
      : conditionFromContainer($, rowElement);
    if (!condition) return;

    items.push({
      sourceType: "other_shop",
      storeName: storeName ?? "店舗名不明",
      condition,
      price,
    });
  });

  return deduplicate(items);
}

export function replaceEmbeddedOtherShopItems(
  productHtml: string,
  fetched: FetchedProduct,
): FetchedProduct {
  const $ = cheerio.load(productHtml);
  const marker = $(`#${CAPTURE_ELEMENT_ID}`).first();
  if (marker.length === 0 || marker.attr("data-state") !== "ready") return fetched;

  const capturedHtml = marker.text().trim();
  if (!capturedHtml) return fetched;

  const items = extractOtherShopItemsSafely(capturedHtml);
  return {
    ...fetched,
    junkItems: [
      ...fetched.junkItems.filter((item) => item.sourceType !== "other_shop"),
      ...items,
    ],
  };
}

function findOfferContainer(
  $: cheerio.CheerioAPI,
  start: cheerio.Cheerio<any>,
): cheerio.Cheerio<any> | null {
  let current = start;
  for (let depth = 0; depth < 9; depth += 1) {
    const text = normalizeText(current.text());
    if (firstPrice(text) !== null && sellerNameFromContainer($, current)) {
      return current;
    }
    const parent = current.parent();
    if (parent.length === 0 || parent.is("body, html")) break;
    current = parent;
  }
  return null;
}

function conditionFromContainer(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<any>,
): string | null {
  for (const anchor of container.find("a[href]").toArray()) {
    const candidate = $(anchor);
    const text = normalizeText(candidate.text());
    if (looksLikeCondition(text) && isStoreOfferConditionLink(candidate.attr("href"))) {
      return cleanCondition(text);
    }
  }

  const text = normalizeText(container.text());
  const match = text.match(CONDITION_IN_TEXT);
  return match ? cleanCondition(match[1]) : null;
}

function sellerNameFromContainer(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<any>,
): string | null {
  for (const anchor of container.find("a").toArray()) {
    const sellerName = normalizeSellerName($(anchor).text());
    if (sellerName) return sellerName;
  }
  return null;
}

function normalizeSellerName(value: string): string | null {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(.+?)の出品を見る$/u);
  return match?.[1]?.trim() || null;
}

function isStoreOfferConditionLink(rawHref: string | undefined): boolean {
  if (!rawHref) return false;
  try {
    const url = new URL(rawHref, "https://www.suruga-ya.jp");
    if (!/^\/product\/detail\/[0-9A-Za-z]+\/?$/u.test(url.pathname)) return false;
    return url.searchParams.has("tenpo_cd") || url.searchParams.has("branch_number");
  } catch {
    return false;
  }
}

function looksLikeCondition(value: string): boolean {
  return CONDITION_PREFIX.test(normalizeText(value));
}

function cleanCondition(value: string): string {
  return normalizeText(value)
    .replace(/\s*※?タイムセール\s*$/u, "")
    .replace(/\s*販売$/u, "")
    .trim();
}

function firstPrice(value: string): number | null {
  const match = normalizeText(value).match(YEN_PRICE)?.[0];
  return match ? normalizePrice(match) : null;
}

function deduplicate(items: FetchedJunkItem[]): FetchedJunkItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.storeName ?? ""}\u0000${item.condition}\u0000${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeText(value: string): string {
  return value.replace(/[\u00a0\u3000]/gu, " ").replace(/\s+/gu, " ").trim();
}
