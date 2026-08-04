import * as cheerio from "cheerio";
import { fetchSurugayaHtml } from "@/lib/surugaya-browser";

export type StockStatus = "in_stock" | "out_of_stock" | "unknown";

export type FetchedProduct = {
  title: string;
  imageUrl: string | null;
  salePrice: number | null;
  buyPrice: number | null;
  stockStatus: StockStatus;
};

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

export class InvalidSurugayaUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSurugayaUrlError";
  }
}

export function normalizePrice(text: string): number | null {
  const normalized = text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
  const match = normalized.match(/[¥￥]?\s*([0-9][0-9,]*)\s*円?/);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

export function detectStockStatus(html: string): StockStatus {
  const $ = cheerio.load(html);
  const text = normalizeText($("body").text());
  const salePrice = extractSalePrice($);

  // In-stock pages include a generic warning saying that a physical shop may
  // already be sold out. The cart and the current mail-order price therefore
  // take priority over that warning.
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
    if (imageUrl) {
      return imageUrl;
    }
  }

  return null;
}

export async function fetchProduct(url: string): Promise<FetchedProduct> {
  const productUrl = normalizeSurugayaUrl(url);
  const html = await fetchSurugayaHtml(productUrl);
  return parseProductHtml(html);
}

export function parseProductHtml(html: string): FetchedProduct {
  const $ = cheerio.load(html);
  const title = extractTitle($);

  if (!title) {
    throw new Error("商品タイトルを取得できませんでした");
  }

  return {
    title,
    imageUrl: extractImageUrl(html),
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

  const productPath = parsed.pathname.match(/^\/product\/detail\/([0-9]+)\/?$/);
  if (!productPath) {
    throw new InvalidSurugayaUrlError("駿河屋の商品詳細URLを入力してください");
  }

  return `https://www.suruga-ya.jp/product/detail/${productPath[1]}`;
}

function extractTitle($: cheerio.CheerioAPI): string | null {
  for (const selector of SELECTORS.title) {
    const text = $(selector).first().text().replace(/\s+/g, " ").trim();
    if (text) {
      return text.replace(/通販ショップの駿河屋$/u, "").trim();
    }
  }

  return null;
}

function extractSalePrice($: cheerio.CheerioAPI): number | null {
  const text = normalizeText($("body").text());
  const saleBlocks = text.matchAll(/(?:中古|新品|予約)(.{0,160}?)(?:\(税込\)|（税込）)/g);

  for (const match of saleBlocks) {
    const block = match[1];
    if (/他のショップ|送料|手数料/.test(block)) {
      continue;
    }

    const prices = [...block.matchAll(/[¥￥]?\s*([0-9][0-9,]*)\s*円/g)]
      .map((priceMatch) => Number.parseInt(priceMatch[1].replace(/,/g, ""), 10))
      .filter(Number.isFinite);

    if (prices.length > 0) {
      // Time-sale pages show the regular price followed by the current price.
      return prices.at(-1) ?? null;
    }
  }

  return null;
}

function extractBuyPrice($: cheerio.CheerioAPI): number | null {
  const text = normalizeText($("body").text());
  const match = text.match(/買取価格\s*[:：]?\s*[¥￥]?\s*([0-9][0-9,]*)\s*円/);
  return match ? Number.parseInt(match[1].replace(/,/g, ""), 10) : null;
}

function normalizeText(text: string): string {
  return text.replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl, "https://www.suruga-ya.jp").toString();
  } catch {
    return null;
  }
}
