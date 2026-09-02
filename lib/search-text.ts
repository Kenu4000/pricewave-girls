import { resolveBrandIdentity } from "@/lib/brand-aliases";
import { manufacturerForProduct } from "@/lib/product-manufacturer-override";

export type SearchableProductText = {
  title?: string | null;
  manufacturer?: string | null;
  releaseDate?: string | null;
  category?: string | null;
  modelNumber?: string | null;
  managementNumber?: string | null;
  detailsJson?: string | null;
};

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja");
}

export function includesSearchText(value: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query.trim());
  return normalizedQuery.length === 0 || normalizeSearchText(value).includes(normalizedQuery);
}

function detailSearchValues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([key, value]) => !key.startsWith("__pricewave") && typeof value === "string")
      .map(([, value]) => value as string);
  } catch {
    return [];
  }
}

export function productSearchValues(product: SearchableProductText): string[] {
  const effectiveManufacturer = product.title
    ? manufacturerForProduct(product.title, product.manufacturer)
    : product.manufacturer ?? null;
  const canonicalManufacturer = effectiveManufacturer
    ? resolveBrandIdentity(effectiveManufacturer).label
    : null;

  return [
    product.title,
    product.manufacturer,
    effectiveManufacturer,
    canonicalManufacturer,
    product.releaseDate,
    product.category,
    product.modelNumber,
    product.managementNumber,
    ...detailSearchValues(product.detailsJson),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function productIncludesSearchText(
  product: SearchableProductText,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return true;
  return productSearchValues(product).some((value) =>
    normalizeSearchText(value).includes(normalizedQuery),
  );
}

export function buildProductSearchText(product: SearchableProductText): string {
  return productSearchValues(product).map(normalizeSearchText).join("\n");
}
