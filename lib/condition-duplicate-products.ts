import { conditionAnnotatedProductIds, splitProductTitleCondition } from "./product-title-condition";

export type ConditionDuplicateProduct = {
  id: number;
  title: string;
  condition?: string | null;
  conditionRank?: string | null;
  detailsJson?: string | null;
  surugayaUrl?: string | null;
};

export type ConditionDuplicateMatch = {
  product: ConditionDuplicateProduct;
  normalProductIds: number[];
  identity: string;
};

export function conditionDuplicateIdentity(title: string): string {
  return splitProductTitleCondition(title).title
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\p{P}]/gu, "")
    .trim();
}

export function findConditionDuplicateProducts(
  products: ConditionDuplicateProduct[],
): ConditionDuplicateMatch[] {
  const conditionIds = new Set(conditionAnnotatedProductIds(products));
  const normalIdsByIdentity = new Map<string, number[]>();

  for (const product of products) {
    if (conditionIds.has(product.id)) continue;
    const identity = conditionDuplicateIdentity(product.title);
    if (!identity) continue;
    const ids = normalIdsByIdentity.get(identity) ?? [];
    ids.push(product.id);
    normalIdsByIdentity.set(identity, ids);
  }

  return products.flatMap((product) => {
    if (!conditionIds.has(product.id)) return [];
    const identity = conditionDuplicateIdentity(product.title);
    const normalProductIds = normalIdsByIdentity.get(identity) ?? [];
    if (normalProductIds.length === 0) return [];
    return [{ product, normalProductIds, identity }];
  });
}
