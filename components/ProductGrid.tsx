"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  formatProductCardPriceChange,
  productCardPriceChangeDirection,
  type PriceChangeDirection,
  type ProductCardPriceChange,
  type ProductCardPriceChangeSummaries,
  type SaleAvailabilityState,
} from "@/lib/product-card-price-change";
import {
  prependUniqueProduct,
  PRODUCT_REVEAL_EVENT,
  type ProductPreview,
} from "@/lib/product-preview";
import styles from "./ProductGrid.module.css";

type RenderedProduct = ProductPreview & { revealKey: number };
type ProductCardState = {
  condition: string | null;
  conditionRank: string | null;
  isTimeSale: boolean;
  regularSalePrice: number | null;
};
type ProductCardStates = Record<number, ProductCardState>;

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

function formatProductCondition(condition: string | null | undefined, rank: string | null | undefined) {
  if (rank === "B" || condition) {
    return condition ? `状態: ランクB（${condition}）` : "状態: ランクB";
  }
  return "状態: 通常";
}

function formatReleaseDate(date: string | null) {
  return date ? date.replace(/-/g, "/") : null;
}

function formatPriceChangeDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString("ja-JP") : "変更なし";
}

function saleAvailabilityBorderClass(state: SaleAvailabilityState): string {
  switch (state) {
    case "restocked":
      return styles.saleRestocked;
    case "mail_order_sold_out":
      return styles.saleMailOrderSoldOut;
    case "out_of_stock":
      return styles.saleOutOfStock;
    case "unfetched":
      return styles.saleUnfetched;
  }
}

function changeBorderClass(
  kind: "sale" | "buy",
  change: ProductCardPriceChange | undefined,
): string {
  if (!change) return "";

  if (kind === "sale" && change.availabilityState) {
    return saleAvailabilityBorderClass(change.availabilityState);
  }

  const direction = productCardPriceChangeDirection(change);
  if (kind === "sale") {
    if (direction === "up") return styles.saleUp;
    if (direction === "down") return styles.saleDown;
    return styles.saleChanged;
  }

  if (direction === "up") return styles.buyUp;
  if (direction === "down") return styles.buyDown;
  return styles.buyChanged;
}

function saleAvailabilityTagClass(state: SaleAvailabilityState): string {
  switch (state) {
    case "restocked":
      return styles.restocked;
    case "mail_order_sold_out":
      return styles.mailOrderSoldOut;
    case "out_of_stock":
      return styles.outOfStock;
    case "unfetched":
      return styles.unfetched;
  }
}

function changeTagClass(change: ProductCardPriceChange): string {
  if (change.type === "sale" && change.availabilityState) {
    return saleAvailabilityTagClass(change.availabilityState);
  }

  const direction: PriceChangeDirection = productCardPriceChangeDirection(change);
  if (direction === "up") return styles.up;
  if (direction === "down") return styles.down;
  return styles.changed;
}

function PriceChangeTag({ change }: { change: ProductCardPriceChange }) {
  return (
    <span className={`${styles.changeTag} ${changeTagClass(change)}`}>
      {formatProductCardPriceChange(change)}
    </span>
  );
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
  const [priceChangeSummaries, setPriceChangeSummaries] =
    useState<ProductCardPriceChangeSummaries>({});
  const [cardStates, setCardStates] = useState<ProductCardStates>({});
  const revealKeyRef = useRef(0);
  const productIds = products.map((product) => product.id).join(",");

  useEffect(() => {
    setProducts(initialProducts.map((product) => ({ ...product, revealKey: 0 })));
  }, [initialProducts]);

  useEffect(() => {
    if (!productIds) {
      setPriceChangeSummaries({});
      setCardStates({});
      return;
    }

    const controller = new AbortController();
    void Promise.all([
      fetch(`/api/products/price-changes?ids=${encodeURIComponent(productIds)}`, {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("価格変更情報を取得できませんでした。");
        return response.json() as Promise<{
          summaries?: ProductCardPriceChangeSummaries;
        }>;
      }),
      fetch(`/api/products/card-states?ids=${encodeURIComponent(productIds)}`, {
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("商品状態を取得できませんでした。");
        return response.json() as Promise<{ states?: ProductCardStates }>;
      }),
    ])
      .then(([changes, states]) => {
        setPriceChangeSummaries(changes.summaries ?? {});
        setCardStates(states.states ?? {});
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPriceChangeSummaries({});
        setCardStates({});
      });

    return () => controller.abort();
  }, [productIds]);

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
      {products.map((product) => {
        const summary = priceChangeSummaries[product.id];
        const saleChange = summary?.sale;
        const buyChange = summary?.buy;
        const storedState = cardStates[product.id];
        const condition = storedState?.condition ?? product.condition ?? null;
        const conditionRank = storedState?.conditionRank ?? product.conditionRank ?? "A";
        const hasConditionIssue = conditionRank === "B" || Boolean(condition);
        const borderClasses = [
          styles.productCard,
          changeBorderClass("sale", saleChange),
          changeBorderClass("buy", buyChange),
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <Link
            className={`card product-card ${borderClasses} ${
              product.revealKey > 0 ? "product-card-revealed" : ""
            }`}
            href={`/products/${product.id}`}
            key={`${product.id}:${product.revealKey}`}
          >
            {saleChange || buyChange ? (
              <div className={styles.changeRail}>
                {saleChange ? <PriceChangeTag change={saleChange} /> : null}
                {buyChange ? <PriceChangeTag change={buyChange} /> : null}
              </div>
            ) : null}
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
              <span className="badge">{formatStockStatus(product.stockStatus)}</span>
              {hasConditionIssue ? (
                <span className="badge">{formatProductCondition(condition, conditionRank)}</span>
              ) : null}
              {storedState?.isTimeSale && storedState.regularSalePrice != null ? (
                <span className="badge">通常価格: {formatPrice(storedState.regularSalePrice)}</span>
              ) : null}
            </div>
            <div className="price-change-date muted">
              価格変更日: {formatPriceChangeDate(product.priceChangedAt)}
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
              <span>履歴: {product.hasHistory ? "あり" : "なし"}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
