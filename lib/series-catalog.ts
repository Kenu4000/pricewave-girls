import catalog01 from "../data/series-catalog-01.json";
import catalog02 from "../data/series-catalog-02.json";
import catalog03 from "../data/series-catalog-03.json";
import catalog04 from "../data/series-catalog-04.json";
import catalog05 from "../data/series-catalog-05.json";
import catalog06 from "../data/series-catalog-06.json";
import { splitProductTitleCondition } from "./product-title-condition";

export type ProductSeries = {
  id: string;
  name: string;
  brand: string;
  titles: string[];
};

export type SeriesProductCandidate = {
  id: number;
  title: string;
  condition?: string | null;
  conditionRank?: string | null;
};

export type SeriesProductGroup = {
  title: string;
  productIds: number[];
};

export const SERIES_CATALOG: ProductSeries[] = [
  ...catalog01,
  ...catalog02,
  ...catalog03,
  ...catalog04,
  ...catalog05,
  ...catalog06,
];

type CatalogTitleEntry = {
  series: ProductSeries;
  title: string;
  normalized: string;
};

const STOREFRONT_PLATFORM_PREFIX =
  /^(?:Windows|Macintosh|Mac(?:\s*OS)?|PC[- ]?98|X68000|FM[- ]?TOWNS|MS[- ]?DOS|DOS)/iu;
const STOREFRONT_SOFTWARE_PREFIX = /^.{0,100}?ソフト[\s　]+/u;

function stripStorefrontCategoryPrefix(value: string): string {
  const trimmed = value.trim();
  if (!STOREFRONT_PLATFORM_PREFIX.test(trimmed)) return trimmed;

  const prefix = STOREFRONT_SOFTWARE_PREFIX.exec(trimmed);
  return prefix ? trimmed.slice(prefix[0].length).trim() : trimmed;
}

function displayProductTitle(value: string): string {
  // 凡例では機種・媒体表記もedition識別情報として残す。
  // 状態違いだけは商品名から除く。
  return splitProductTitleCondition(value).title.trim();
}

function normalizeTitle(value: string): string {
  // シリーズ判定時だけ駿河屋の機種・媒体カテゴリ前置きを無視する。
  return splitProductTitleCondition(stripStorefrontCategoryPrefix(value)).title
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\p{P}]/gu, "")
    .trim();
}

function titleMatches(productTitle: string, catalogTitle: string): boolean {
  const product = normalizeTitle(productTitle);
  const catalog = normalizeTitle(catalogTitle);
  if (!product || !catalog) return false;
  return product === catalog || product.startsWith(catalog);
}

const CATALOG_TITLES: CatalogTitleEntry[] = SERIES_CATALOG.flatMap((series) =>
  series.titles.map((title) => ({
    series,
    title,
    normalized: normalizeTitle(title),
  })),
).sort((left, right) => right.normalized.length - left.normalized.length);

export function findProductSeries(productTitle: string): ProductSeries | null {
  const normalized = normalizeTitle(productTitle);
  if (!normalized) return null;

  const match = CATALOG_TITLES.find(
    (entry) => normalized === entry.normalized || normalized.startsWith(entry.normalized),
  );
  return match?.series ?? null;
}

export function findSeriesCanonicalTitle(
  productTitle: string,
  series: ProductSeries,
): string | null {
  const candidates = series.titles
    .map((title) => ({ title, normalized: normalizeTitle(title) }))
    .sort((left, right) => right.normalized.length - left.normalized.length);
  const normalized = normalizeTitle(productTitle);
  const match = candidates.find(
    (candidate) =>
      normalized === candidate.normalized || normalized.startsWith(candidate.normalized),
  );
  return match?.title ?? null;
}

function isNormalConditionProduct(product: SeriesProductCandidate): boolean {
  if (product.conditionRank === "B" || product.condition) return false;
  return splitProductTitleCondition(product.title).conditionRank !== "B";
}

export function buildSeriesProductGroups(
  series: ProductSeries,
  products: SeriesProductCandidate[],
): SeriesProductGroup[] {
  const grouped = new Map<string, SeriesProductCandidate[]>();

  for (const product of products) {
    const title = findSeriesCanonicalTitle(product.title, series);
    if (!title) continue;
    const bucket = grouped.get(title) ?? [];
    bucket.push(product);
    grouped.set(title, bucket);
  }

  return series.titles.flatMap((title) => {
    const normal = (grouped.get(title) ?? [])
      .filter(isNormalConditionProduct)
      .slice()
      .sort((left, right) => {
        const titleCompare = displayProductTitle(left.title).localeCompare(
          displayProductTitle(right.title),
          "ja-JP",
        );
        return titleCompare || left.id - right.id;
      });

    // ランクB・欠品等の状態違いは、通常品がDBに存在しない場合でもシリーズ商品として代用しない。
    // 同じシリーズ作品の通常版・廉価版・対応OS版など、状態Aのeditionだけを1商品=1グループで保持する。
    return normal.map((product) => ({
      title: displayProductTitle(product.title),
      productIds: [product.id],
    }));
  });
}

export function isSeriesTitleMatch(productTitle: string, catalogTitle: string): boolean {
  return titleMatches(productTitle, catalogTitle);
}
