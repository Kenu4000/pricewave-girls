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
  manufacturer: string | null;
  releaseDate: string | null;
  modelNumber: string | null;
  stockStatus: string | null;
  condition?: string | null;
  conditionRank?: string | null;
  hasHistory: boolean;
  isNew: boolean;
};

export function nextProductRevealDelay(random = Math.random): number {
  const range = PRODUCT_REVEAL_MAX_DELAY_MS - PRODUCT_REVEAL_MIN_DELAY_MS + 1;
  return PRODUCT_REVEAL_MIN_DELAY_MS + Math.floor(random() * range);
}

export function prependUniqueProduct<T extends { id: number }>(
  products: T[],
  product: T,
  limit: number,
): T[] {
  return [product, ...products.filter((item) => item.id !== product.id)].slice(0, limit);
}
