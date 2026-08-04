"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  prependUniqueProduct,
  PRODUCT_REVEAL_EVENT,
  type ProductPreview,
} from "@/lib/product-preview";

type RenderedProduct = ProductPreview & { revealKey: number };

function formatPrice(price: number | null | undefined) {
  return price == null ? "未取得" : `${price.toLocaleString("ja-JP")}円`;
}

function formatStockStatus(status: string | null) {
  switch (status) {
    case "in_stock":
      return "在庫あり";
    case "out_of_stock":
      return "在庫なし";
    default:
      return "在庫不明";
  }
}

function formatReleaseDate(date: string | null) {
  return date ? date.replace(/-/g, "/") : null;
}

export function ProductGrid({
  initialProducts,
  perPage,
  streamEnabled,
  filtersActive,
}: {
  initialProducts: ProductPreview[];
  perPage: number;
  streamEnabled: boolean;
  filtersActive: boolean;
}) {
  const [products, setProducts] = useState<RenderedProduct[]>(() =>
    initialProducts.map((product) => ({ ...product, revealKey: 0 })),
  );
  const revealKeyRef = useRef(0);

  useEffect(() => {
    setProducts(initialProducts.map((product) => ({ ...product, revealKey: 0 })));
  }, [initialProducts]);

  useEffect(() => {
    if (!streamEnabled) return;

    const revealProduct = (event: Event) => {
      const product = (event as CustomEvent<ProductPreview>).detail;
      if (!product || typeof product.id !== "number") return;

      revealKeyRef.current += 1;
      const nextProduct = { ...product, revealKey: revealKeyRef.current };
      setProducts((current) => prependUniqueProduct(current, nextProduct, perPage));
    };

    window.addEventListener(PRODUCT_REVEAL_EVENT, revealProduct);
    return () => window.removeEventListener(PRODUCT_REVEAL_EVENT, revealProduct);
  }, [perPage, streamEnabled]);

  if (products.length === 0) {
    return (
      <div className="card">
        <p>{filtersActive ? "条件に一致する商品がありません。" : "まだ商品が登録されていません。"}</p>
        {filtersActive ? (
          <Link className="button secondary" href="/products">
            条件をクリア
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div aria-live="polite" className="grid">
      {products.map((product) => (
        <Link
          className={`card product-card ${product.revealKey > 0 ? "product-card-revealed" : ""}`}
          href={`/products/${product.id}`}
          key={`${product.id}:${product.revealKey}`}
        >
          <div className="product-image">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={product.title} src={product.imageUrl} />
            ) : (
              <span className="muted">No Image</span>
            )}
          </div>
          <div className="product-title">{product.title}</div>
          <div className="price-row">
            <span className="badge">販売: {formatPrice(product.salePrice)}</span>
            <span className="badge">買取: {formatPrice(product.buyPrice)}</span>
          </div>
          <dl className="product-facts">
            {product.manufacturer ? (
              <div><dt>ブランド</dt><dd>{product.manufacturer}</dd></div>
            ) : null}
            {product.releaseDate ? (
              <div><dt>発売日</dt><dd>{formatReleaseDate(product.releaseDate)}</dd></div>
            ) : null}
            {product.modelNumber ? (
              <div><dt>型番</dt><dd>{product.modelNumber}</dd></div>
            ) : null}
          </dl>
          <div className="meta-row muted">
            <span>{formatStockStatus(product.stockStatus)}</span>
            <span>履歴: {product.hasHistory ? "あり" : "なし"}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
