"use client";

import { useEffect, useState } from "react";
import { ProductGrid } from "@/components/ProductGrid";
import type { ProductPreview } from "@/lib/product-preview";
import {
  parseRecentlyViewedIds,
  RECENTLY_VIEWED_LIMIT,
  RECENTLY_VIEWED_STORAGE_KEY,
} from "@/lib/recently-viewed";

export function HistoryProducts() {
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      let ids: number[] = [];
      try {
        ids = parseRecentlyViewedIds(
          window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY),
        );
      } catch {
        ids = [];
      }

      if (ids.length === 0) {
        if (active) setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/products/recent?ids=${encodeURIComponent(ids.join(","))}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("閲覧履歴を取得できませんでした。");
        const result = await response.json() as { products?: ProductPreview[] };
        if (active) setProducts(result.products ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError") && active) {
          setProducts([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  function clearHistory() {
    try {
      window.localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
    } catch {
      // localStorage が使えない場合でも表示中の履歴は消す。
    }
    setProducts([]);
    setLoading(false);
  }

  if (loading) {
    return <div className="card"><p className="muted">閲覧履歴を読み込んでいます。</p></div>;
  }

  if (products.length === 0) {
    return <div className="card"><p>まだ閲覧した商品はありません。</p></div>;
  }

  return (
    <>
      <div className="list-heading">
        <p className="muted">最近見た商品 {products.length}件 / 最大{RECENTLY_VIEWED_LIMIT}件</p>
        <button className="button secondary" onClick={clearHistory} type="button">
          履歴を消去
        </button>
      </div>
      <ProductGrid
        filtersActive={false}
        initialProducts={products}
        perPage={RECENTLY_VIEWED_LIMIT}
        streamEnabled={false}
      />
    </>
  );
}
