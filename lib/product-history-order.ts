export type ProductHistoryOrder = "asc" | "desc";

export type ProductHistoryOrderCandidate = {
  id: number;
  histories: Array<{ checkedAt: Date }>;
};

export function sortProductIdsByLatestHistory(
  candidates: ProductHistoryOrderCandidate[],
  order: ProductHistoryOrder,
): number[] {
  return [...candidates]
    .sort((left, right) => {
      const leftCheckedAt = left.histories[0]?.checkedAt.getTime() ?? null;
      const rightCheckedAt = right.histories[0]?.checkedAt.getTime() ?? null;

      // 確認履歴が無い商品は、昇順・降順どちらでも末尾へ送る。
      if (leftCheckedAt === null && rightCheckedAt === null) {
        return order === "desc" ? right.id - left.id : left.id - right.id;
      }
      if (leftCheckedAt === null) return 1;
      if (rightCheckedAt === null) return -1;

      if (leftCheckedAt !== rightCheckedAt) {
        return order === "desc"
          ? rightCheckedAt - leftCheckedAt
          : leftCheckedAt - rightCheckedAt;
      }

      return order === "desc" ? right.id - left.id : left.id - right.id;
    })
    .map((product) => product.id);
}
