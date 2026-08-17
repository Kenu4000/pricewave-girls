import { resolveBrandIdentity } from "@/lib/brand-aliases";

export type BrandOrderProduct = {
  id: number;
  manufacturer: string | null;
};

export type OrderedBrandGroup = {
  key: string;
  label: string;
  productIds: number[];
};

const japaneseCollator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});

export function orderedBrandGroups(products: BrandOrderProduct[]): OrderedBrandGroup[] {
  const groups = new Map<string, { label: string; productIds: Set<number> }>();

  for (const product of products) {
    if (!product.manufacturer) continue;
    const identity = resolveBrandIdentity(product.manufacturer);
    if (!identity.key) continue;

    const group = groups.get(identity.key) ?? {
      label: identity.label,
      productIds: new Set<number>(),
    };
    group.productIds.add(product.id);
    groups.set(identity.key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      productIds: [...group.productIds].sort((left, right) => left - right),
    }))
    .sort(
      (left, right) =>
        japaneseCollator.compare(left.label, right.label) ||
        left.key.localeCompare(right.key),
    );
}

export function productIdsAfterBrand(
  products: BrandOrderProduct[],
  boundaryBrand: string,
): { boundary: OrderedBrandGroup; targetBrands: OrderedBrandGroup[]; productIds: number[] } {
  const groups = orderedBrandGroups(products);
  const boundaryIdentity = resolveBrandIdentity(boundaryBrand);
  const boundaryIndex = groups.findIndex((group) => group.key === boundaryIdentity.key);

  if (boundaryIndex < 0) {
    throw new Error(`基準ブランド「${boundaryBrand}」が登録商品に見つかりません。`);
  }

  const boundary = groups[boundaryIndex];
  const targetBrands = groups.slice(boundaryIndex + 1);
  const productIds = targetBrands.flatMap((group) => group.productIds);

  return { boundary, targetBrands, productIds };
}
