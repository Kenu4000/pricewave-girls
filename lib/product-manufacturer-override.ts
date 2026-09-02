function normalizeProductTitle(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

const TITLE_MANUFACTURER_OVERRIDES = new Map<string, string>([
  [normalizeProductTitle("メタルオレンジ EXカスタム"), "カスタム"],
  [normalizeProductTitle("狂った果実"), "フェアリーテイル"],
]);

export function manufacturerForProduct(
  title: string,
  manufacturer: string | null | undefined,
): string | null {
  return TITLE_MANUFACTURER_OVERRIDES.get(normalizeProductTitle(title)) ?? manufacturer ?? null;
}

export function withProductManufacturerOverride<T extends { title: string; manufacturer: string | null }>(
  product: T,
): T {
  const manufacturer = manufacturerForProduct(product.title, product.manufacturer);
  return manufacturer === product.manufacturer ? product : { ...product, manufacturer };
}
