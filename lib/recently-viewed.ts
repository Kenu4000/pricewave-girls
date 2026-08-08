export const RECENTLY_VIEWED_STORAGE_KEY = "pricewave:recently-viewed-products";
export const RECENTLY_VIEWED_LIMIT = 40;

export function normalizeRecentlyViewedIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  const ids: number[] = [];
  const seen = new Set<number>();

  for (const item of value) {
    const id = typeof item === "number" ? item : typeof item === "string" ? Number(item) : NaN;
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    ids.push(id);
    seen.add(id);
    if (ids.length >= RECENTLY_VIEWED_LIMIT) break;
  }

  return ids;
}

export function parseRecentlyViewedIds(raw: string | null): number[] {
  if (!raw) return [];
  try {
    return normalizeRecentlyViewedIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function addRecentlyViewedProductId(ids: number[], productId: number): number[] {
  if (!Number.isInteger(productId) || productId <= 0) return normalizeRecentlyViewedIds(ids);
  return [productId, ...ids.filter((id) => id !== productId)].slice(0, RECENTLY_VIEWED_LIMIT);
}
