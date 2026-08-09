export type LastCheckedSortableProduct = {
  id: number;
  updatedAt: Date;
  histories: Array<{ checkedAt: Date }>;
};

export function lastCheckedAt(product: LastCheckedSortableProduct): Date {
  return product.histories[0]?.checkedAt ?? product.updatedAt;
}

export function sortProductsByLastChecked<T extends LastCheckedSortableProduct>(
  products: T[],
  direction: "asc" | "desc",
): T[] {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...products].sort((left, right) => {
    const timeDifference =
      lastCheckedAt(left).getTime() - lastCheckedAt(right).getTime();
    if (timeDifference !== 0) return timeDifference * multiplier;
    return (left.id - right.id) * multiplier;
  });
}
