"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  addRecentlyViewedProductId,
  parseRecentlyViewedIds,
  RECENTLY_VIEWED_STORAGE_KEY,
} from "@/lib/recently-viewed";

export function ViewedProductTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/^\/products\/(\d+)\/?$/u);
    if (!match) return;

    const productId = Number(match[1]);
    if (!Number.isInteger(productId) || productId <= 0) return;

    try {
      const current = parseRecentlyViewedIds(
        window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY),
      );
      const next = addRecentlyViewedProductId(current, productId);
      window.localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 履歴保存が利用できないブラウザでも商品ページ表示は継続する。
    }
  }, [pathname]);

  return null;
}
