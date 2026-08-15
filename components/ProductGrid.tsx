"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  formatProductCardPriceChange,
  formatTimeSaleCardPriceChange,
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
  timeSaleStartedAt: string | null;
  timeSaleEndsAt: string | null;
};
type ProductCardStates = Record<number, ProductCardState>;
type CrawlIntervalValue = 1 | 3 | 7 | 14 | null;
type CrawlIntervals = Record<number, CrawlIntervalValue>;

const CRAWL_INTERVALS: Array<{ value: CrawlIntervalValue; label: string }> = [
  { value: 1, label: "1日" },
  { value: 3, label: "3日" },
  { value: 7, label: "7日" },
  { value: 14, label: "14日" },
  { value: null, label: "無" },
];

function formatPrice(price: number | null | undefined) {
  return price == null ? "未取得" : `${price.toLocaleString("ja-JP")}円`;
}

function formatStockStatus(status: string | null) {
  switch (status) {
    case "out_of_stock":
      return "在庫なし";
    case "unknown":
    case null:
      return "在庫不明";
    default:
      return null;
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
    case "restocked": return styles.saleRestocked;
    case "mail_order_sold_out": return styles.saleMailOrderSoldOut;
    case "out_of_stock": return styles.saleOutOfStock;
    case "unfetched": return styles.saleUnfetched;
  }
}

function changeBorderClass(
  kind: "sale" | "buy",
  change: ProductCardPriceChange | undefined,
): string {
  if (!change) return "";
  if (kind === "sale" && change.availabilityState) return saleAvailabilityBorderClass(change.availabilityState);
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
    case "restocked": return styles.restocked;
    case "mail_order_sold_out": return styles.mailOrderSoldOut;
    case "out_of_stock": return styles.outOfStock;
    case "unfetched": return styles.unfetched;
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
  return <span className={`${styles.changeTag} ${changeTagClass(change)}`}>{formatProductCardPriceChange(change)}</span>;
}

function TimeSaleChangeTag({ currentPrice, regularPrice, startedAt }: {
  currentPrice: number;
  regularPrice: number;
  startedAt: string | null;
}) {
  return (
    <span className={`${styles.changeTag} ${styles.timeSaleTag}`}>
      {formatTimeSaleCardPriceChange(regularPrice, currentPrice, startedAt)}
    </span>
  );
}

function activeIntervalClass(value: CrawlIntervalValue): string {
  if (value === 1) return styles.intervalOne;
  if (value === 3) return styles.intervalThree;
  if (value === 7) return styles.intervalSeven;
  if (value === 14) return styles.intervalFourteen;
  return styles.intervalOff;
}

function CrawlIntervalButtons({ productId, value, saving, onChange }: {
  productId: number;
  value: CrawlIntervalValue;
  saving: boolean;
  onChange: (productId: number, value: CrawlIntervalValue) => void;
}) {
  return (
    <div className={styles.intervalSection}>
      <span className={styles.intervalLabel}>巡回周期</span>
      <div className={styles.intervalButtons} role="group" aria-label="自動巡回周期">
        {CRAWL_INTERVALS.map((option) => {
          const selected = option.value === value;
          return (
            <button
              aria-pressed={selected}
              className={`${styles.intervalButton} ${selected ? activeIntervalClass(option.value) : ""}`}
              disabled={saving}
              key={option.label}
              onClick={() => onChange(productId, option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProductGrid({ initialProducts, perPage, streamEnabled, filtersActive }: {
  initialProducts: ProductPreview[];
  perPage: number;
  streamEnabled: boolean;
  filtersActive: boolean;
}) {
  const [products, setProducts] = useState<RenderedProduct[]>(() =>
    initialProducts.map((product) => ({ ...product, revealKey: 0 })),
  );
  const [priceChangeSummaries, setPriceChangeSummaries] = useState<ProductCardPriceChangeSummaries>({});
  const [cardStates, setCardStates] = useState<ProductCardStates>({});
  const [crawlIntervals, setCrawlIntervals] = useState<CrawlIntervals>({});
  const [savingIntervalProductId, setSavingIntervalProductId] = useState<number | null>(null);
  const revealKeyRef = useRef(0);
  const liveOrderLockedRef = useRef(false);
  const productIds = products.map((product) => product.id).join(",");

  useEffect(() => {
    if (!streamEnabled) {
      liveOrderLockedRef.current = false;
      setProducts(initialProducts.map((product) => ({ ...product, revealKey: 0 })));
      return;
    }
    if (liveOrderLockedRef.current) return;
    setProducts(initialProducts.map((product) => ({ ...product, revealKey: 0 })));
  }, [initialProducts, streamEnabled]);

  useEffect(() => {
    if (!productIds) {
      setPriceChangeSummaries({});
      setCardStates({});
      setCrawlIntervals({});
      return;
    }

    const controller = new AbortController();
    void Promise.all([
      fetch(`/api/products/price-changes?ids=${encodeURIComponent(productIds)}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("価格変更情報を取得できませんでした。");
          return response.json() as Promise<{ summaries?: ProductCardPriceChangeSummaries }>;
        }),
      fetch(`/api/products/card-states?ids=${encodeURIComponent(productIds)}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("商品状態を取得できませんでした。");
          return response.json() as Promise<{ states?: ProductCardStates }>;
        }),
      fetch(`/api/products/crawl-intervals?ids=${encodeURIComponent(productIds)}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("巡回周期を取得できませんでした。");
          return response.json() as Promise<{ intervals?: CrawlIntervals }>;
        }),
    ])
      .then(([changes, states, intervals]) => {
        setPriceChangeSummaries(changes.summaries ?? {});
        setCardStates(states.states ?? {});
        setCrawlIntervals(intervals.intervals ?? {});
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [productIds]);

  useEffect(() => {
    if (!streamEnabled) return;
    const revealProduct = (event: Event) => {
      const product = (event as CustomEvent<ProductPreview>).detail;
      if (!product || typeof product.id !== "number") return;
      liveOrderLockedRef.current = true;
      revealKeyRef.current += 1;
      const nextProduct = { ...product, revealKey: revealKeyRef.current };
      setProducts((current) => prependUniqueProduct(current, nextProduct, perPage));
    };
    window.addEventListener(PRODUCT_REVEAL_EVENT, revealProduct);
    return () => window.removeEventListener(PRODUCT_REVEAL_EVENT, revealProduct);
  }, [perPage, streamEnabled]);

  async function changeCrawlInterval(productId: number, value: CrawlIntervalValue) {
    const previous = crawlIntervals[productId] ?? 1;
    setCrawlIntervals((current) => ({ ...current, [productId]: value }));
    setSavingIntervalProductId(productId);
    try {
      const response = await fetch(`/api/products/${productId}/crawl-interval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crawlIntervalDays: value }),
      });
      if (!response.ok) throw new Error("巡回周期を保存できませんでした。");
    } catch {
      setCrawlIntervals((current) => ({ ...current, [productId]: previous }));
    } finally {
      setSavingIntervalProductId(null);
    }
  }

  if (products.length === 0) {
    return (
      <div className="card">
        <p>{filtersActive ? "条件に一致する商品がありません。" : "まだ商品が登録されていません。"}</p>
        {filtersActive ? <Link className="button secondary" href="/products">条件をクリア</Link> : null}
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
        const stockStatusLabel = formatStockStatus(product.stockStatus);
        const activeTimeSale = storedState?.isTimeSale === true && storedState.regularSalePrice != null && product.salePrice != null && storedState.regularSalePrice !== product.salePrice;
        const visibleSaleChange = activeTimeSale ? undefined : saleChange;
        const borderClasses = [
          styles.productCard,
          activeTimeSale ? styles.timeSaleBorder : changeBorderClass("sale", visibleSaleChange),
          changeBorderClass("buy", buyChange),
        ].filter(Boolean).join(" ");
        const crawlInterval = Object.prototype.hasOwnProperty.call(crawlIntervals, product.id)
          ? crawlIntervals[product.id]
          : (product.crawlIntervalDays ?? 1) as CrawlIntervalValue;

        return (
          <article
            className={`card product-card ${borderClasses} ${product.revealKey > 0 ? "product-card-revealed" : ""}`}
            key={`${product.id}:${product.revealKey}`}
          >
            <Link className={styles.productCardBody} href={`/products/${product.id}`}>
              {activeTimeSale || visibleSaleChange || buyChange ? (
                <div className={styles.changeRail}>
                  {activeTimeSale ? (
                    <TimeSaleChangeTag currentPrice={product.salePrice!} regularPrice={storedState!.regularSalePrice!} startedAt={storedState?.timeSaleStartedAt ?? null} />
                  ) : visibleSaleChange ? <PriceChangeTag change={visibleSaleChange} /> : null}
                  {buyChange ? <PriceChangeTag change={buyChange} /> : null}
                </div>
              ) : null}
              <div className="product-image">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={product.title} src={product.imageUrl} />
                ) : <span className="muted">No Image</span>}
              </div>
              <div className="product-title">{product.title}</div>
              <div className="price-row">
                <span className="badge">販売: {formatPrice(product.salePrice)}</span>
                <span className="badge">買取: {formatPrice(product.buyPrice)}</span>
                {stockStatusLabel ? <span className="badge">{stockStatusLabel}</span> : null}
                {hasConditionIssue ? <span className="badge">{formatProductCondition(condition, conditionRank)}</span> : null}
                {storedState?.isTimeSale && storedState.regularSalePrice != null ? <span className="badge">通常価格: {formatPrice(storedState.regularSalePrice)}</span> : null}
              </div>
              <div className="price-change-date muted">価格変更日: {formatPriceChangeDate(product.priceChangedAt)}</div>
              <dl className="product-facts">
                {product.manufacturer ? <div><dt>ブランド</dt><dd>{product.manufacturer}</dd></div> : null}
                {product.releaseDate ? <div><dt>発売日</dt><dd>{formatReleaseDate(product.releaseDate)}</dd></div> : null}
                {product.modelNumber ? <div><dt>型番</dt><dd>{product.modelNumber}</dd></div> : null}
              </dl>
              <div className="meta-row muted"><span>履歴: {product.hasHistory ? "あり" : "なし"}</span></div>
            </Link>
            <CrawlIntervalButtons
              onChange={changeCrawlInterval}
              productId={product.id}
              saving={savingIntervalProductId === product.id}
              value={crawlInterval}
            />
          </article>
        );
      })}
    </div>
  );
}
