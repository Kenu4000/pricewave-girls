import { resolveBrandIdentity } from "@/lib/brand-aliases";

export type ManufacturerCrawlIntervalState = {
  manufacturer: string | null;
  crawlIntervalDays: number | null;
};

export type InheritableCrawlInterval = 7 | 14 | null;

export function manufacturerIdentityKey(
  manufacturer: string | null | undefined,
): string | null {
  if (!manufacturer) return null;
  const key = resolveBrandIdentity(manufacturer).key;
  return key || null;
}

export function uniformManufacturerCrawlIntervals(
  products: ManufacturerCrawlIntervalState[],
): Map<string, InheritableCrawlInterval> {
  const states = new Map<
    string,
    { count: number; interval: number | null; mixed: boolean }
  >();

  for (const product of products) {
    const key = manufacturerIdentityKey(product.manufacturer);
    if (!key) continue;

    const existing = states.get(key);
    if (!existing) {
      states.set(key, {
        count: 1,
        interval: product.crawlIntervalDays,
        mixed: false,
      });
      continue;
    }

    existing.count += 1;
    if (existing.interval !== product.crawlIntervalDays) existing.mixed = true;
  }

  return new Map(
    [...states.entries()].flatMap(([key, state]) => {
      if (state.count === 0 || state.mixed) return [];
      if (state.interval === null || state.interval === 7 || state.interval === 14) {
        return [[key, state.interval as InheritableCrawlInterval]];
      }
      return [];
    }),
  );
}

export function allDisabledManufacturerKeys(
  products: ManufacturerCrawlIntervalState[],
): Set<string> {
  return new Set(
    [...uniformManufacturerCrawlIntervals(products).entries()]
      .filter(([, interval]) => interval === null)
      .map(([key]) => key),
  );
}
