export type PriceSpreadProduct = {
  id: number;
  title: string;
  latestSalePrice: number | null;
  latestBuyPrice: number | null;
};

export type PriceSpreadDirection = "asc" | "desc";

export function sortProductsByPriceSpread<T extends PriceSpreadProduct>(
  products: T[],
  direction: PriceSpreadDirection,
): T[] {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...products].sort((left, right) => {
    const leftSpread = priceSpread(left);
    const rightSpread = priceSpread(right);

    if (leftSpread === null && rightSpread === null) {
      return compareTitles(left.title, right.title) || left.id - right.id;
    }
    if (leftSpread === null) return 1;
    if (rightSpread === null) return -1;

    return (
      (leftSpread - rightSpread) * multiplier ||
      compareTitles(left.title, right.title) ||
      left.id - right.id
    );
  });
}

export function priceSpread(product: PriceSpreadProduct): number | null {
  if (product.latestSalePrice === null || product.latestBuyPrice === null) return null;
  return Math.abs(product.latestSalePrice - product.latestBuyPrice);
}

function compareTitles(left: string, right: string): number {
  return left.localeCompare(right, "ja", { numeric: true, sensitivity: "base" });
}
