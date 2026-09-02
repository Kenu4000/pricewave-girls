import { resolveBrandIdentity } from "@/lib/brand-aliases";
import { splitProductTitleCondition } from "@/lib/product-title-condition";

function normalizeProductTitle(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "").trim();
}

const TITLE_MANUFACTURER_OVERRIDES = new Map<string, string>([
  [normalizeProductTitle("メタルオレンジ EXカスタム"), "カスタム"],
  [normalizeProductTitle("狂った果実"), "フェアリーテイル"],
]);

const LEAF_BRAND_KEY = resolveBrandIdentity("Leaf").key;

function normalizeStoredManufacturer(manufacturer: string | null | undefined): string | null {
  if (!manufacturer) return manufacturer ?? null;
  return resolveBrandIdentity(manufacturer).key === LEAF_BRAND_KEY ? "Leaf" : manufacturer;
}

export function manufacturerForProduct(
  title: string,
  manufacturer: string | null | undefined,
): string | null {
  const baseTitle = splitProductTitleCondition(title).title;
  const titleOverride = TITLE_MANUFACTURER_OVERRIDES.get(normalizeProductTitle(baseTitle));
  if (titleOverride) return titleOverride;
  return normalizeStoredManufacturer(manufacturer);
}

export function withProductManufacturerOverride<T extends { title: string; manufacturer: string | null }>(
  product: T,
): T {
  const manufacturer = manufacturerForProduct(product.title, product.manufacturer);
  return manufacturer === product.manufacturer ? product : { ...product, manufacturer };
}
