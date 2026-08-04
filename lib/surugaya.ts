import * as cheerio from "cheerio";
import { fetchSurugayaHtml } from "@/lib/surugaya-browser";

export type StockStatus = "in_stock" | "out_of_stock" | "unknown";
export type JunkSourceType = "alternate_condition" | "other_shop";

export type FetchedJunkItem = {
  sourceType: JunkSourceType;
  storeName: string | null;
  condition: string;
  price: number;
};

export type FetchedProduct = {
  title: string;
  imageUrl: string | null;
  managementNumber: string | null;
  manufacturer: string | null;
  releaseDate: string | null;
  listPrice: number | null;
  modelNumber: string | null;
  category: string | null;
  details: Record<string, string>;
  junkItems: FetchedJunkItem[];
  salePrice: number | null;
  buyPrice: number | null;
  stockStatus: StockStatus;
};

const OTHER_SHOPS_DATA_ID = "pricewave-other-shops-data";

const SELECTORS = {
  title: ["h1", ".item-detail-title", ".product-title", "title"],
  image: [
    "meta[property='og:image']",
    "#item_image img",
    ".item-image img",
    ".product-image img",
    "img[itemprop='image']",
  ],
} as const;

const KNOWN_DETAIL_LABELS = [
  "管理番号",
  "メーカー",
  "発売日",
  "定価",
  "型番",
  "カテゴリ",
  "対応OS",
  "動作OS",
  "OS",
  "対応機種",
  "JAN",
  "ISBN",
  "原画",
  "シナリオ",
  "声優",
  "キャラクターデザイン",
  "シリーズ",
] as const;

export class InvalidSurugayaUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSurugayaUrlError";
  }
}

export function normalizePrice(text: string): number | null {
  const normalized = text
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/，/g, ",");
  const match = normalized.match(/[¥￥]?\s*([0-9][0-9,]*)\s*円?/);
  if (!match) return null;

  const value = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

export function detectStockStatus(html: string): StockStatus {
  const $ = cheerio.load(html);
  const text = normalizeText($("body").text());
  const salePrice = extractSalePrice($);

  if (salePrice !== null && /カートに入れる|購入する/.test(text)) {
    return "in_stock";
  }

  if (
    /申し訳ございません[。\s]*品切れ中です|在庫なし|売り切れ|売切れ|販売不可|入荷待ち/.test(
      text,
    )
  ) {
    return "out_of_stock";
  }

  if (salePrice !== null || /在庫あり|在庫有り|販売中/.test(text)) {
    return "in_stock";
  }

  return "unknown";
}

export function extractImageUrl(html: string): string | null {
  const $ = cheerio.load(html);

  for (const selector of SELECTORS.image) {
    const element = $(selector).first();
    const raw = element.attr("content") ?? element.attr("src") ?? element.attr("data-src");
    const imageUrl = toAbsoluteUrl(raw);
    if (imageUrl) return imageUrl;
  }

  return null;
}

export async function fetchProduct(url: string): Promise<FetchedProduct> {
  const productUrl = normalizeSurugayaUrl(url);
  const html = await fetchSurugayaHtml(productUrl);
  return parseProductHtml(html);
}

export function parseProductHtml(
  html: string,
  explicitOtherShopsHtml?: string,
): FetchedProduct {
  const $ = cheerio.load(html);
  const title = extractTitle($);

  if (
    /(?:^|\W)(?:cf-chl-|challenges\.cloudflare\.com)/i.test(html) ||
    /^(?:Just a moment|Attention Required)/i.test(title ?? "")
  ) {
    throw new Error(
      "アクセス確認中のページは取り込めません。商品ページが表示されてから実行してください",
    );
  }

  if (!title) throw new Error("商品タイトルを取得できませんでした");

  const details = extractProductDetails($);
  const otherShopsHtml = explicitOtherShopsHtml ?? extractEmbeddedOtherShopsHtml($);

  return {
    title,
    imageUrl: extractImageUrl(html),
    managementNumber: extractManagementNumber(details["管理番号"]),
    manufacturer: details["メーカー"] ?? null,
    releaseDate: normalizeReleaseDate(details["発売日"]),
    listPrice: details["定価"] ? normalizePrice(details["定価"]) : null,
    modelNumber: details["型番"] ?? null,
    category: details["カテゴリ"] ?? null,
    details,
    junkItems: deduplicateJunkItems([
      ...extractAlternateConditionItems($),
      ...extractOtherShopItems(otherShopsHtml),
    ]),
    salePrice: extractSalePrice($),
    buyPrice: extractBuyPrice($),
    stockStatus: detectStockStatus(html),
  };
}

export function normalizeSurugayaUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new InvalidSurugayaUrlError("有効なURLを入力してください");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    (hostname !== "suruga-ya.jp" && !hostname.endsWith(".suruga-ya.jp"))
  ) {
    throw new InvalidSurugayaUrlError("駿河屋の商品URLを入力してください");
  }

  const productPath = parsed.pathname.match(/^\/product\/detail\/([0-9A-Za-z]+)\/?$/);
  if (!productPath) {
    throw new InvalidSurugayaUrlError("駿河屋の商品詳細URLを入力してください");
  }

  return `https://www.suruga-ya.jp/product/detail/${productPath[1]}`;
}

export function extractOtherShopItems(html: string): FetchedJunkItem[] {
  if (!html.trim()) return [];

  const $ = cheerio.load(html);
  const items: FetchedJunkItem[] = [];

  $("table tr").each((_, row) => {
    const cells = $(row)
      .children("th, td")
      .toArray()
      .map((cell) => normalizeText($(cell).text()));
    if (cells.length < 2) return;

    const conditionIndex = cells.findIndex((cell) => isConditionText(cell));
    const priceSearchEnd = conditionIndex > 0 ? conditionIndex : cells.length;
    let priceIndex = cells
      .slice(0, priceSearchEnd)
      .findIndex((cell) => containsYenPrice(cell));
    if (priceIndex < 0) priceIndex = cells.findIndex((cell) => containsYenPrice(cell));
    if (priceIndex < 0) return;

    const price = normalizePrice(cells[priceIndex]);
    if (price === null) return;

    const condition =
      conditionIndex >= 0 ? cleanCondition(cells[conditionIndex]) : "状態不明";
    const storeName = extractStoreNameFromRow(
      $,
      $(row),
      cells,
      conditionIndex,
      priceIndex,
    );

    items.push({
      sourceType: "other_shop",
      storeName: storeName ?? "店舗名不明",
      condition,
      price,
    });
  });

  // Some versions of the marketplace page use card/list markup instead of a table.
  $(
    "[data-shop-name], .other-shop-item, .other_shop_item, .marketplace-item, .marketplace_item",
  ).each((_, element) => {
    const block = $(element);
    const text = normalizeText(block.text());
    if (!containsYenPrice(text)) return;

    const prices = [...text.matchAll(/[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/gu)]
      .map((match) => normalizePrice(match[0]))
      .filter((price): price is number => price !== null);
    const price = prices[0];
    if (price === undefined) return;

    const conditionText = firstText(block, [
      "[data-condition]",
      ".condition",
      ".item-condition",
      ".item_condition",
      "[class*='condition']",
    ]);
    const storeText =
      block.attr("data-shop-name") ??
      firstText(block, [
        ".shop-name",
        ".shop_name",
        ".store-name",
        ".store_name",
        "[class*='shopName']",
        "[class*='storeName']",
      ]) ??
      extractSellerLinkText($, block);

    items.push({
      sourceType: "other_shop",
      storeName: normalizeStoreName(storeText) ?? "店舗名不明",
      condition: conditionText ? cleanCondition(conditionText) : extractConditionFromText(text),
      price,
    });
  });

  return deduplicateJunkItems(items);
}

function extractTitle($: cheerio.CheerioAPI): string | null {
  for (const selector of SELECTORS.title) {
    const text = $(selector).first().text().replace(/\s+/g, " ").trim();
    if (text) return text.replace(/通販ショップの駿河屋$/u, "").trim();
  }
  return null;
}

function extractSalePrice($: cheerio.CheerioAPI): number | null {
  const text = normalizeText($("body").text());
  const saleBlocks = text.matchAll(/(?:中古|新品|予約)(.{0,160}?)(?:\(税込\)|（税込）)/g);

  for (const match of saleBlocks) {
    const block = match[1];
    if (/他のショップ|送料|手数料/.test(block)) continue;

    const prices = [...block.matchAll(/[¥￥]?\s*([0-9][0-9,]*)\s*円/g)]
      .map((priceMatch) => Number.parseInt(priceMatch[1].replace(/,/g, ""), 10))
      .filter(Number.isFinite);

    if (prices.length > 0) return prices.at(-1) ?? null;
  }

  return null;
}

function extractBuyPrice($: cheerio.CheerioAPI): number | null {
  const text = normalizeText($("body").text());
  const match = text.match(/買取価格\s*[:：]?\s*[¥￥]?\s*([0-9][0-9,]*)\s*円/);
  return match ? Number.parseInt(match[1].replace(/,/g, ""), 10) : null;
}

function extractAlternateConditionItems($: cheerio.CheerioAPI): FetchedJunkItem[] {
  const bodyText = normalizeText($("body").text());
  const marker = "その他の状態を選ぶ";
  const markerIndex = bodyText.indexOf(marker);
  if (markerIndex < 0) return [];

  const afterMarker = bodyText.slice(markerIndex + marker.length);
  const endIndex = afterMarker.search(
    /条件により|他のショップ|この商品の買取価格|買取価格|近くの店舗|商品詳細情報/u,
  );
  const alternateStateText = endIndex >= 0 ? afterMarker.slice(0, endIndex) : afterMarker;
  const blocks = alternateStateText.matchAll(
    /((?:中古|新品|予約)\s+.*?)(?=\s*(?:中古|新品|予約)\s+|$)/gu,
  );
  const items: FetchedJunkItem[] = [];

  for (const match of blocks) {
    const block = normalizeText(match[1]);
    if (!/[（(]税込[）)]/u.test(block)) continue;

    const priceIndex = block.search(/[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/u);
    if (priceIndex < 0) continue;

    const condition = normalizeText(block.slice(0, priceIndex)).replace(
      /\s*※?タイムセール\s*$/u,
      "",
    );
    if (!condition || /^(?:中古|新品|予約)$/u.test(condition)) continue;

    const prices = [...block.matchAll(/[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/gu)]
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

  return deduplicateJunkItems(items);
}

function extractEmbeddedOtherShopsHtml($: cheerio.CheerioAPI): string {
  return $("#" + OTHER_SHOPS_DATA_ID).first().text().trim();
}

function extractStoreNameFromRow(
  $: cheerio.CheerioAPI,
  rowElement: cheerio.Cheerio<unknown>,
  cells: string[],
  conditionIndex: number,
  priceIndex: number,
): string | null {
  const sellerLink = extractSellerLinkText($, rowElement);
  if (sellerLink) return sellerLink;

  const candidateIndexes = [
    conditionIndex >= 0 ? conditionIndex + 1 : -1,
    priceIndex + 2,
    priceIndex + 1,
  ].filter((index, position, indexes) => index >= 0 && indexes.indexOf(index) === position);

  for (const index of candidateIndexes) {
    const candidate = normalizeStoreName(cells[index]);
    if (candidate && isStoreNameCandidate(candidate)) return candidate;
  }

  for (const [index, cell] of cells.entries()) {
    if (index === priceIndex || index === conditionIndex) continue;
    const candidate = normalizeStoreName(cell);
    if (candidate && isStoreNameCandidate(candidate)) return candidate;
  }

  return null;
}

function extractSellerLinkText(
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<unknown>,
): string | null {
  const links = element
    .find("a")
    .toArray()
    .map((anchor) => normalizeText($(anchor).text()));

  for (const text of links) {
    const match = text.match(/(.+?)の出品を見る$/u);
    if (match) return normalizeStoreName(match[1]);
  }

  return null;
}

function normalizeStoreName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeText(value)
    .replace(/^GoogleMap\s*/iu, "")
    .replace(/\s*[0-5](?:\.\d)?\s*\([0-9,]+件\).*$/u, "")
    .replace(/\s*の出品を見る$/u, "")
    .replace(/\s*店頭でも購入できます。?$/u, "")
    .trim();
  return normalized || null;
}

function isStoreNameCandidate(value: string): boolean {
  return !(
    containsYenPrice(value) ||
    isConditionText(value) ||
    /発送|配送料|送料無料|返品|購入オプション|カート|数量|GoogleMap|店頭でも購入|価格[:：]/u.test(
      value,
    )
  );
}

function firstText(
  element: cheerio.Cheerio<unknown>,
  selectors: string[],
): string | null {
  for (const selector of selectors) {
    const text = normalizeText(element.find(selector).first().text());
    if (text) return text;
  }
  return null;
}

function extractConditionFromText(text: string): string {
  const match = text.match(
    /(?:^|\s)((?:中古|新品|予約|プレミア|ワケアリ).*?)(?=\s*[¥￥]?[0-9０-９]|$)/u,
  );
  return match ? cleanCondition(match[1]) : "状態不明";
}

function cleanCondition(value: string): string {
  const normalized = normalizeText(value)
    .replace(/\s*※?タイムセール\s*$/u, "")
    .replace(/\s*販売$/u, "")
    .trim();
  return normalized || "状態不明";
}

function isConditionText(value: string): boolean {
  return /^(?:中古|新品|予約|プレミア|ワケアリ)/u.test(normalizeText(value));
}

function containsYenPrice(value: string): boolean {
  return /[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円/u.test(value);
}

function deduplicateJunkItems(items: FetchedJunkItem[]): FetchedJunkItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [item.sourceType, item.storeName ?? "", item.condition, item.price].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractProductDetails($: cheerio.CheerioAPI): Record<string, string> {
  const details: Record<string, string> = {};

  $("table").each((_, table) => {
    const pairs: Array<[string, string]> = [];

    $(table)
      .find("tr")
      .each((__, row) => {
        const cells = $(row).children("th, td").toArray();
        for (let index = 0; index + 1 < cells.length; index += 2) {
          const label = cleanDetailLabel($(cells[index]).text());
          const value = normalizeText($(cells[index + 1]).text());
          if (isPlausibleDetailPair(label, value)) pairs.push([label, value]);
        }
      });

    const knownCount = pairs.filter(([label]) =>
      KNOWN_DETAIL_LABELS.includes(label as (typeof KNOWN_DETAIL_LABELS)[number]),
    ).length;
    if (knownCount >= 2) {
      for (const [label, value] of pairs) details[label] = value;
    }
  });

  $("dl").each((_, list) => {
    const pairs: Array<[string, string]> = [];
    $(list)
      .children("dt")
      .each((__, term) => {
        const label = cleanDetailLabel($(term).text());
        const value = normalizeText($(term).next("dd").text());
        if (isPlausibleDetailPair(label, value)) pairs.push([label, value]);
      });

    const knownCount = pairs.filter(([label]) =>
      KNOWN_DETAIL_LABELS.includes(label as (typeof KNOWN_DETAIL_LABELS)[number]),
    ).length;
    if (knownCount >= 2) {
      for (const [label, value] of pairs) details[label] = value;
    }
  });

  const bodyText = normalizeText($("body").text());
  const markerIndex = bodyText.indexOf("商品詳細情報");
  if (markerIndex >= 0) {
    const afterMarker = bodyText.slice(markerIndex + "商品詳細情報".length);
    const endIndex = afterMarker.search(/(?:商品詳細情報)?\s*備考|商品情報の訂正|商品レビュー/);
    const detailText = endIndex >= 0 ? afterMarker.slice(0, endIndex) : afterMarker.slice(0, 1200);
    const labelPattern = KNOWN_DETAIL_LABELS.map(escapeRegExp).join("|");

    for (const label of KNOWN_DETAIL_LABELS) {
      if (details[label]) continue;
      const match = detailText.match(
        new RegExp(`${escapeRegExp(label)}\\s*(.+?)\\s*(?=${labelPattern}|$)`),
      );
      const value = match ? normalizeText(match[1]) : "";
      if (value) details[label] = value;
    }
  }

  return details;
}

function cleanDetailLabel(text: string): string {
  return normalizeText(text).replace(/[：:]$/u, "").trim();
}

function isPlausibleDetailPair(label: string, value: string): boolean {
  return label.length > 0 && label.length <= 30 && value.length > 0 && value.length <= 500;
}

function extractManagementNumber(value: string | undefined): string | null {
  if (!value) return null;

  const number = value.match(/[0-9]{6,}/)?.[0];
  const normalized = value.replace(/^(?:中古|新品|予約)\s*[：:]?\s*/u, "").trim();
  return (number ?? normalized) || null;
}

function normalizeReleaseDate(value: string | undefined): string | null {
  const match = value?.match(/(\d{4})[\/.年](\d{1,2})[\/.月](\d{1,2})日?/u);
  if (!match) return null;

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeText(text: string): string {
  return text.replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toAbsoluteUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl, "https://www.suruga-ya.jp").toString();
  } catch {
    return null;
  }
}
