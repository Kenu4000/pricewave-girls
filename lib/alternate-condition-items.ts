import * as cheerio from "cheerio";
import type { FetchedJunkItem, FetchedProduct } from "@/lib/surugaya";

const ALTERNATE_CONDITION_MARKER = "その他の状態を選ぶ";
const ALTERNATE_CONDITION_END =
  /(?:1[,.，]?500|１５００)円以上お買上げで送料無料|条件により|他のショップ|この商品の買取価格|買取価格|近くの店舗|商品詳細情報/u;
const PRICE_PATTERN = /[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/gu;

/**
 * Re-extract alternate-condition offers while limiting each offer to its own
 * tax marker. This prevents footer text such as
 * "1,500円以上お買上げで送料無料" from becoming the final offer price.
 */
export function extractAlternateConditionItemsSafely(html: string): FetchedJunkItem[] {
  const $ = cheerio.load(html);
  const bodyText = normalizeText($("body").text());
  const markerIndex = bodyText.indexOf(ALTERNATE_CONDITION_MARKER);
  if (markerIndex < 0) return [];

  const afterMarker = bodyText.slice(markerIndex + ALTERNATE_CONDITION_MARKER.length);
  const endIndex = afterMarker.search(ALTERNATE_CONDITION_END);
  const alternateStateText = endIndex >= 0 ? afterMarker.slice(0, endIndex) : afterMarker;
  const blocks = alternateStateText.matchAll(
    /((?:中古|新品|予約)\s+.*?)(?=\s*(?:中古|新品|予約)\s+|$)/gu,
  );
  const items: FetchedJunkItem[] = [];

  for (const match of blocks) {
    const block = normalizeText(match[1]);
    const offerText = block.match(/^.*?[（(]税込[）)]/u)?.[0];
    if (!offerText) continue;

    const priceIndex = offerText.search(PRICE_PATTERN);
    if (priceIndex < 0) continue;

    const condition = normalizeText(offerText.slice(0, priceIndex)).replace(
      /\s*※?タイムセール\s*$/u,
      "",
    );
    if (!condition || /^(?:中古|新品|予約)$/u.test(condition)) continue;

    const prices = [...offerText.matchAll(PRICE_PATTERN)]
      .map((priceMatch) => normalizePrice(priceMatch[0]))
      .filter((price): price is number => price !== null);
    const price = prices.at(-1);
    if (price === undefined) continue;

    items.push({
      sourceType: "alternate_condition",
      storeName: null,
      condition,
      price,
    });
  }

  return deduplicate(items);
}

export function replaceAlternateConditionItems(
  html: string,
  fetched: FetchedProduct,
): FetchedProduct {
  return {
    ...fetched,
    junkItems: [
      ...extractAlternateConditionItemsSafely(html),
      ...fetched.junkItems.filter((item) => item.sourceType !== "alternate_condition"),
    ],
  };
}

function normalizePrice(text: string): number | null {
  const normalized = text
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/，/g, ",");
  const match = normalized.match(/[¥￥]?\s*([0-9][0-9,]*)\s*円?/u);
  if (!match) return null;

  const value = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function normalizeText(text: string): string {
  return text.replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

function deduplicate(items: FetchedJunkItem[]): FetchedJunkItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [item.condition.normalize("NFKC"), item.price].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
