import * as cheerio from "cheerio";
import { fetchSurugayaHtml } from "@/lib/surugaya-browser";

export type StockStatus = "in_stock" | "out_of_stock" | "unknown";

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

  if (
    /(?:^|\W)(?:cf-chl-|challenges\.cloudflare\.com)/i.test(html) ||
    /^(?:Just a moment|Attention Required)/i.test(title ?? "")
  ) {
    throw new Error("アクセス確認中のページは取り込めません。商品ページが表示されてから実行してください");
  }

  if (!title) {
    throw new Error("商品タイトルを取得できませんでした");
  }

  const details = extractProductDetails($);

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
          if (isPlausibleDetailPair(label, value)) {
            pairs.push([label, value]);
          }
        }
      });

    const knownCount = pairs.filter(([label]) =>
      KNOWN_DETAIL_LABELS.includes(label as (typeof KNOWN_DETAIL_LABELS)[number]),
    ).length;
    if (knownCount >= 2) {
      for (const [label, value] of pairs) {
        details[label] = value;
      }
    }
  });

  $("dl").each((_, list) => {
    const pairs: Array<[string, string]> = [];
    $(list)
      .children("dt")
      .each((__, term) => {
        const label = cleanDetailLabel($(term).text());
        const value = normalizeText($(term).next("dd").text());
        if (isPlausibleDetailPair(label, value)) {
          pairs.push([label, value]);
        }
      });

    const knownCount = pairs.filter(([label]) =>
      KNOWN_DETAIL_LABELS.includes(label as (typeof KNOWN_DETAIL_LABELS)[number]),
    ).length;
    if (knownCount >= 2) {
      for (const [label, value] of pairs) {
        details[label] = value;
      }
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
      if (details[label]) {
        continue;
      }
      const match = detailText.match(
        new RegExp(`${escapeRegExp(label)}\\s*(.+?)\\s*(?=${labelPattern}|$)`),
      );
      const value = match ? normalizeText(match[1]) : "";
      if (value) {
        details[label] = value;
      }
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
  if (!value) {
    return null;
  }

  const number = value.match(/[0-9]{6,}/)?.[0];
  const normalized = value.replace(/^(?:中古|新品|予約)\s*[：:]?\s*/u, "").trim();
  return (number ?? normalized) || null;
}

function normalizeReleaseDate(value: string | undefined): string | null {
  const match = value?.match(/(\d{4})[\/.年](\d{1,2})[\/.月](\d{1,2})日?/u);
  if (!match) {
    return null;
  }

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeText(text: string): string {
  return text.replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
