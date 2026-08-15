(function exposePricewaveNewProductDiscoveryPolicy(globalObject) {
  const DEFAULT_RELEASE_DISCOVERY_URL =
    "https://www.suruga-ya.jp/search?category=652042222&search_word=&adult_s=1&rankBy=release_date%28int%29%3Adescending";
  const LEGACY_DEFAULT_AUTO_ADD_URL =
    "https://www.suruga-ya.jp/search?category=65204&genre2=%E3%83%93%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%AB%E3%83%8E%E3%83%99%E3%83%AB%28%E7%BE%8E%E5%B0%91%E5%A5%B3%E3%82%B2%E3%83%BC%E3%83%A0%29&search_word=";

  function productIdFromUrl(rawUrl) {
    try {
      return new URL(String(rawUrl || "")).pathname.match(
        /^\/product\/detail\/([0-9]+)\/?$/u,
      )?.[1] ?? null;
    } catch {
      return null;
    }
  }

  function normalizeReleaseDate(value) {
    const source = String(value || "").normalize("NFKC").trim();
    const match = source.match(
      /(\d{4})\s*(?:[\/.-]|年)\s*(\d{1,2})\s*(?:[\/.-]|月)\s*(\d{1,2})\s*日?/u,
    );
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
  }

  function localDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function isReleaseDiscoveryUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      if (
        !(url.hostname === "suruga-ya.jp" || url.hostname.endsWith(".suruga-ya.jp")) ||
        url.pathname !== "/search"
      ) {
        return false;
      }
      const rankBy = url.searchParams.get("rankBy") || "";
      return (
        url.searchParams.get("category") === "652042222" &&
        /release_date\s*\(int\)\s*:\s*descending/iu.test(rankBy)
      );
    } catch {
      return false;
    }
  }

  function shouldReplaceLegacyAutoAddUrl(rawUrl) {
    const source = String(rawUrl || "").trim();
    if (!source) return true;
    try {
      const current = new URL(source);
      const legacy = new URL(LEGACY_DEFAULT_AUTO_ADD_URL);
      return (
        current.hostname === legacy.hostname &&
        current.pathname === legacy.pathname &&
        current.searchParams.get("category") === legacy.searchParams.get("category") &&
        current.searchParams.get("genre2") === legacy.searchParams.get("genre2") &&
        !current.searchParams.get("rankBy")
      );
    } catch {
      return false;
    }
  }

  function selectReleaseDiscoveryProducts(
    products,
    registeredIds,
    today = localDateKey(),
    _existingStopDate = null,
  ) {
    const source = Array.isArray(products) ? products : [];
    const registered = registeredIds instanceof Set
      ? registeredIds
      : new Set(Array.isArray(registeredIds) ? registeredIds.map(String) : []);
    const selected = [];
    let skippedFuture = 0;
    let skippedMissingDate = 0;
    let duplicateCount = 0;

    for (const product of source) {
      const url = String(product?.url || "");
      const id = productIdFromUrl(url);
      if (!id) continue;

      const releaseDate = normalizeReleaseDate(product?.releaseDate);
      if (!releaseDate) {
        // 予約商品との区別ができないため、発売日を読めない商品は従来通り自動追加しない。
        skippedMissingDate += 1;
        continue;
      }

      if (releaseDate > today) {
        // 予約商品は発売日までは追加しない。
        skippedFuture += 1;
        continue;
      }

      if (registered.has(id)) {
        // 登録済み商品が並んでいても探索は止めない。
        // 古いページに未登録商品が残っている可能性があるため、最終ページまで掘れるようにする。
        duplicateCount += 1;
        continue;
      }

      selected.push({ id, url, releaseDate });
    }

    return {
      products: selected,
      // 互換用フィールド。登録済み商品の発売日を停止境界にはしない。
      stopDate: null,
      reachedOlderDate: false,
      skippedFuture,
      skippedMissingDate,
      duplicateCount,
    };
  }

  const policy = {
    DEFAULT_RELEASE_DISCOVERY_URL,
    LEGACY_DEFAULT_AUTO_ADD_URL,
    productIdFromUrl,
    normalizeReleaseDate,
    localDateKey,
    isReleaseDiscoveryUrl,
    shouldReplaceLegacyAutoAddUrl,
    selectReleaseDiscoveryProducts,
  };

  globalObject.PricewaveNewProductDiscoveryPolicy = policy;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = policy;
  }
})(typeof globalThis === "undefined" ? self : globalThis);
