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

function normalizeTitle(value: string): string {
  return splitProductTitleCondition(value).title
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\p{P}]/gu, "")
    .trim();
}

function titleMatches(productTitle: string, catalogTitle: string): boolean {
  const product = normalizeTitle(productTitle);
  const catalog = normalizeTitle(catalogTitle);
  if (!product || !catalog) return false;
  if (product === catalog) return true;
  if (product.startsWith(catalog)) return true;
  return catalog.length >= 6 && product.includes(catalog);
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

  const match = CATALOG_TITLES.find((entry) => {
    if (normalized === entry.normalized) return true;
    if (normalized.startsWith(entry.normalized)) return true;
    return entry.normalized.length >= 6 && normalized.includes(entry.normalized);
  });
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
  const match = candidates.find((candidate) => {
    if (normalized === candidate.normalized) return true;
    if (normalized.startsWith(candidate.normalized)) return true;
    return candidate.normalized.length >= 6 && normalized.includes(candidate.normalized);
  });
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
    const matches = grouped.get(title) ?? [];
    if (matches.length === 0) return [];
    const normal = matches.filter(isNormalConditionProduct);
    const selected = normal.length > 0 ? normal : matches;
    return [{ title, productIds: selected.map((product) => product.id) }];
  });
}

export function isSeriesTitleMatch(productTitle: string, catalogTitle: string): boolean {
  return titleMatches(productTitle, catalogTitle);
}
