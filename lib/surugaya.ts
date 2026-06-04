import * as cheerio from "cheerio";

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
  salePrice: [
    "#price_info .text-price-detail",
    ".text-price-detail",
    ".price_teika",
    ".price",
    "[itemprop='price']",
  ],
  buyPrice: [
    "#kaitori_price",
    ".kaitori-price",
    ".buying-price",
    ".purchase-price",
    "a[href*='kaitori']",
  ],
  stockText: ["#cart", ".stock", ".zaiko", ".item-detail-info", "body"],
} as const;

const USER_AGENT =
  "Mozilla/5.0 (compatible; PriceWaveGirls/0.1; personal price checker) AppleWebKit/537.36";

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
  const text = SELECTORS.stockText
    .map((selector) => $(selector).text())
    .join("\n")
    .replace(/\s+/g, " ");

  if (/在庫なし|売り切れ|売切れ|品切れ|販売不可|入荷待ち/.test(text)) {
    return "out_of_stock";
  }

  if (/カートに入れる|在庫あり|在庫有り|購入する|販売中/.test(text)) {
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
  const productUrl = validateSurugayaUrl(url);
  const response = await fetch(productUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`駿河屋ページの取得に失敗しました: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const title = extractTitle($);

  if (!title) {
    throw new Error("商品タイトルを取得できませんでした");
  }

  return {
    title,
    imageUrl: extractImageUrl(html),
    salePrice: extractPrice($, SELECTORS.salePrice, [/販売価格|中古|新品|税込/]),
    buyPrice: extractPrice($, SELECTORS.buyPrice, [/買取価格|買取/]),
    stockStatus: detectStockStatus(html),
  };
}

function validateSurugayaUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("有効なURLを入力してください");
  }

  if (!parsed.hostname.endsWith("suruga-ya.jp")) {
    throw new Error("駿河屋の商品URLを入力してください");
  }

  return parsed.toString();
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

function extractPrice(
  $: cheerio.CheerioAPI,
  selectors: readonly string[],
  labelHints: RegExp[] = [],
): number | null {
  for (const selector of selectors) {
    const candidates = $(selector)
      .toArray()
      .map((element) => $(element).text().replace(/\s+/g, " ").trim())
      .filter(Boolean);

    for (const text of candidates) {
      if (labelHints.length > 0 && !labelHints.some((hint) => hint.test(text))) {
        const price = normalizePrice(text);
        if (price !== null) {
          return price;
        }
        continue;
      }

      const price = normalizePrice(text);
      if (price !== null) {
        return price;
      }
    }
  }

  return null;
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
