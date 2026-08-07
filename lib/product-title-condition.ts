const TRAILING_CONDITION_ANNOTATION = /(?:\(|（)\s*状態\s*[:：][^()（）]+(?:\)|）)\s*$/u;

export function hasTrailingConditionAnnotation(title: string): boolean {
  return TRAILING_CONDITION_ANNOTATION.test(title.trim());
}

export function conditionAnnotatedProductIds(
  products: Array<{ id: number; title: string }>,
): number[] {
  return products
    .filter((product) => hasTrailingConditionAnnotation(product.title))
    .map((product) => product.id);
}
