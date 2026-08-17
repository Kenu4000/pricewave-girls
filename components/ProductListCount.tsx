"use client";

import { useEffect, useRef, useState } from "react";
import { BrandCrawlIntervalBulk } from "@/components/BrandCrawlIntervalBulk";
import {
  PRODUCT_REVEAL_EVENT,
  type ProductPreview,
} from "@/lib/product-preview";

export function ProductListCount({
  initialTotalProducts,
  initialAllProducts,
  initialFirstShown,
  initialLastShown,
  perPage,
  filtersActive,
  streamEnabled,
}: {
  initialTotalProducts: number;
  initialAllProducts: number;
  initialFirstShown: number;
  initialLastShown: number;
  perPage: number;
  filtersActive: boolean;
  streamEnabled: boolean;
}) {
  const [totalProducts, setTotalProducts] = useState(initialTotalProducts);
  const [allProducts, setAllProducts] = useState(initialAllProducts);
  const countedProductIdsRef = useRef(new Set<number>());

  useEffect(() => {
    setTotalProducts(initialTotalProducts);
    setAllProducts(initialAllProducts);
    countedProductIdsRef.current.clear();
  }, [initialAllProducts, initialTotalProducts]);

  useEffect(() => {
    if (!streamEnabled) return;

    const countProduct = (event: Event) => {
      const product = (event as CustomEvent<ProductPreview>).detail;
      if (!product?.isNew || countedProductIdsRef.current.has(product.id)) return;

      countedProductIdsRef.current.add(product.id);
      setTotalProducts((current) => current + 1);
      setAllProducts((current) => current + 1);
    };

    window.addEventListener(PRODUCT_REVEAL_EVENT, countProduct);
    return () => window.removeEventListener(PRODUCT_REVEAL_EVENT, countProduct);
  }, [streamEnabled]);

  const firstShown = streamEnabled ? (totalProducts === 0 ? 0 : 1) : initialFirstShown;
  const lastShown = streamEnabled ? Math.min(perPage, totalProducts) : initialLastShown;

  return (
    <>
      <p aria-live="polite" className="muted">
        {filtersActive ? (
          <>
            全{allProducts.toLocaleString("ja-JP")}件中、絞り込み結果：
            <strong>{totalProducts.toLocaleString("ja-JP")}件</strong>
          </>
        ) : (
          <>全{totalProducts.toLocaleString("ja-JP")}件</>
        )}
        {totalProducts > 0 ? (
          <>
            （{firstShown.toLocaleString("ja-JP")}〜{lastShown.toLocaleString("ja-JP")}件を表示）
          </>
        ) : null}
      </p>
      <BrandCrawlIntervalBulk />
    </>
  );
}
