export const PRODUCT_REVEAL_EVENT = "pricewave:product-reveal";
export const PRODUCT_REVEAL_MIN_DELAY_MS = 105;
export const PRODUCT_REVEAL_MAX_DELAY_MS = 330;

export type ProductPreview = {
  id: number;
  title: string;
  imageUrl: string | null;
  salePrice: number | null;
  buyPrice: number | null;
  priceChangedAt: string | null;
  lastCheckedAt?: string | null;
  manufacturer: string | null;
  releaseDate: string | null;
  modelNumber: string | null;
  stockStatus: string | null;
  condition?: string | null;
  conditionRank?: string | null;
  crawlIntervalDays?: number | null;
  hasHistory: boolean;
  isNew: boolean;
};

export function nextProductRevealDelay(random = Math.random): number {
  const range = PRODUCT_REVEAL_MAX_DELAY_MS - PRODUCT_REVEAL_MIN_DELAY_MS + 1;
  return PRODUCT_REVEAL_MIN_DELAY_MS + Math.floor(random() * range);
}

function checkedAtMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function prependUniqueProduct<T extends { id: number; lastCheckedAt?: string | null }>(
  products: T[],
  product: T,
  limit: number,
): T[] {
  return [product, ...products.filter((item) => item.id !== product.id)]
    .sort((left, right) => {
      const leftCheckedAt = checkedAtMs(left.lastCheckedAt);
      const rightCheckedAt = checkedAtMs(right.lastCheckedAt);
      if (leftCheckedAt === null && rightCheckedAt === null) return 0;
      if (leftCheckedAt === null) return 1;
      if (rightCheckedAt === null) return -1;
      return rightCheckedAt - leftCheckedAt;
    })
    .slice(0, limit);
}
