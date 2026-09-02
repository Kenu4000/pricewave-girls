import { resolveBrandIdentity } from "@/lib/brand-aliases";

export type ManufacturerCrawlIntervalState = {
  manufacturer: string | null;
  crawlIntervalDays: number | null;
};

export function manufacturerIdentityKey(
  manufacturer: string | null | undefined,
): string | null {
  if (!manufacturer) return null;
  const key = resolveBrandIdentity(manufacturer).key;
  return key || null;
}

export function allDisabledManufacturerKeys(
  products: ManufacturerCrawlIntervalState[],
): Set<string> {
  const states = new Map<string, { count: number; allDisabled: boolean }>();

  for (const product of products) {
    const key = manufacturerIdentityKey(product.manufacturer);
    if (!key) continue;

    const state = states.get(key) ?? { count: 0, allDisabled: true };
    state.count += 1;
    if (product.crawlIntervalDays !== null) state.allDisabled = false;
    states.set(key, state);
  }

  return new Set(
    [...states.entries()]
      .filter(([, state]) => state.count > 0 && state.allDisabled)
      .map(([key]) => key),
  );
}
