"use client";

import { useEffect } from "react";

export function ProductCrawlSourceLink() {
  useEffect(() => {
    const productId = window.location.pathname.match(/^\/products\/(\d+)\/?$/)?.[1];
    if (!productId) return;

    let cancelled = false;
    void fetch(`/api/products/${productId}/crawl-source`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as { url?: string };
        if (!response.ok || !result.url || cancelled) return;

        const link = [...document.querySelectorAll<HTMLAnchorElement>("a")].find(
          (anchor) => anchor.textContent?.trim() === "駿河屋ページを開く",
        );
        if (link) link.href = result.url;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
