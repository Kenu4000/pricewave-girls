(() => {
  importScripts("new-product-discovery-policy.js");

  const discoveryPolicy = globalThis.PricewaveNewProductDiscoveryPolicy;
  const nativeExecuteScript = chrome.scripting.executeScript.bind(chrome.scripting);
  const nativeTabsGet = chrome.tabs.get.bind(chrome.tabs);
  const wrappedFetch = globalThis.fetch.bind(globalThis);
  const PAGE_ORDER_WAIT_MS = 65_000;

  let releaseDiscoveryActive = false;
  let registeredIds = new Set();
  let registeredIdsLoaded = false;
  let nextExpectedPage = 1;
  let skippedFuture = 0;
  let skippedMissingDate = 0;
  let duplicateCount = 0;
  const pendingSearchPages = new Map();

  function isLocalProductsRequest(input, init) {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url;
      const url = new URL(rawUrl);
      const method = String(init?.method ?? input?.method ?? "GET").toUpperCase();
      return (
        method === "GET" &&
        ["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.port === "3000" &&
        url.pathname === "/api/products"
      );
    } catch {
      return false;
    }
  }

  function pageNumberFromUrl(rawUrl) {
    try {
      return Math.max(1, Number(new URL(String(rawUrl || "")).searchParams.get("page")) || 1);
    } catch {
      return 1;
    }
  }

  function resetDiscoveryState(sourceUrl) {
    releaseDiscoveryActive = discoveryPolicy.isReleaseDiscoveryUrl(sourceUrl);
    registeredIds = new Set();
    registeredIdsLoaded = false;
    nextExpectedPage = pageNumberFromUrl(sourceUrl);
    skippedFuture = 0;
    skippedMissingDate = 0;
    duplicateCount = 0;
    for (const pending of pendingSearchPages.values()) {
      clearTimeout(pending.timeout);
      pending.resolve(pending.results);
    }
    pendingSearchPages.clear();
  }

  function extractReleaseOrderedProductsFromDocument() {
    function canonicalProductUrl(rawUrl) {
      try {
        const url = new URL(rawUrl, window.location.href);
        const match = url.pathname.match(/^\/product\/detail\/([0-9]+)\/?$/u);
        return match
          ? `https://www.suruga-ya.jp/product/detail/${match[1]}`
          : null;
      } catch {
        return null;
      }
    }

    function releaseDateFromAnchor(anchor) {
      let node = anchor;
      for (let depth = 0; depth < 9 && node; depth += 1) {
        const text = node.innerText || node.textContent || "";
        const match = text.match(
          /(?:発売予定日|発売日)\s*[:：]?\s*(\d{4}\s*(?:[\/.-]|年)\s*\d{1,2}\s*(?:[\/.-]|月)\s*\d{1,2}\s*日?)/u,
        );
        if (match) {
          const productLinks = new Set(
            [...node.querySelectorAll('a[href*="/product/detail/"]')]
              .map((link) => canonicalProductUrl(link.getAttribute("href")))
              .filter(Boolean),
          );
          if (productLinks.size <= 4) return match[1];
        }
        node = node.parentElement;
      }
      return null;
    }

    const products = [];
    const seen = new Set();
    for (const anchor of document.querySelectorAll("a[href]")) {
      const url = canonicalProductUrl(anchor.getAttribute("href"));
      if (!url || seen.has(url)) continue;
      seen.add(url);
      products.push({
        url,
        releaseDate: releaseDateFromAnchor(anchor),
      });
    }
    return products;
  }

  function applyDecision(results, releaseProducts) {
    const decision = discoveryPolicy.selectReleaseDiscoveryProducts(
      releaseProducts,
      registeredIds,
      discoveryPolicy.localDateKey(),
    );

    skippedFuture += decision.skippedFuture;
    skippedMissingDate += decision.skippedMissingDate;
    duplicateCount += decision.duplicateCount;

    for (const result of results ?? []) {
      const page = result?.result;
      if (!Array.isArray(page?.productUrls)) continue;
      // productUrlsだけ未登録商品へ絞る。nextUrlは絶対に潰さず、
      // 未登録0件のページ・バッチでも本当の最終ページまで探索を継続させる。
      page.productUrls = decision.products.map((product) => product.url);
    }

    void chrome.storage.local.set({
      releaseDiscoveryStatus: {
        active: releaseDiscoveryActive,
        skippedFuture,
        skippedMissingDate,
        duplicateCount,
        updatedAt: Date.now(),
      },
    });

    return results;
  }

  function drainPendingSearchPages() {
    while (pendingSearchPages.has(nextExpectedPage)) {
      const pending = pendingSearchPages.get(nextExpectedPage);
      pendingSearchPages.delete(nextExpectedPage);
      clearTimeout(pending.timeout);
      const results = applyDecision(pending.results, pending.releaseProducts);
      pending.resolve(results);
      nextExpectedPage += 1;
    }
  }

  function queueSearchPage(pageNumber, results, releaseProducts) {
    if (pageNumber < nextExpectedPage) {
      return Promise.resolve(applyDecision(results, releaseProducts));
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const pending = pendingSearchPages.get(pageNumber);
        if (!pending) return;
        pendingSearchPages.delete(pageNumber);
        pending.resolve(applyDecision(pending.results, pending.releaseProducts));
      }, PAGE_ORDER_WAIT_MS);
      pendingSearchPages.set(pageNumber, { results, releaseProducts, resolve, timeout });
      drainPendingSearchPages();
    });
  }

  globalThis.fetch = async (input, init) => {
    const response = await wrappedFetch(input, init);
    if (
      releaseDiscoveryActive &&
      response.ok &&
      isLocalProductsRequest(input, init)
    ) {
      const body = await response.clone().json().catch(() => null);
      const products = Array.isArray(body?.products) ? body.products : [];
      registeredIds = new Set(
        products
          .map((product) => discoveryPolicy.productIdFromUrl(product?.url))
          .filter(Boolean),
      );
      registeredIdsLoaded = true;
    }
    return response;
  };

  chrome.scripting.executeScript = async (injection) => {
    const results = await nativeExecuteScript(injection);
    if (!releaseDiscoveryActive || !registeredIdsLoaded) return results;

    const containsSearchResult = (results ?? []).some(
      (result) =>
        Array.isArray(result?.result?.productUrls) &&
        Object.prototype.hasOwnProperty.call(result.result, "nextUrl"),
    );
    if (!containsSearchResult || !Number.isInteger(injection?.target?.tabId)) {
      return results;
    }

    const tab = await nativeTabsGet(injection.target.tabId).catch(() => null);
    const pageNumber = pageNumberFromUrl(tab?.url);
    const [releaseResult] = await nativeExecuteScript({
      target: { tabId: injection.target.tabId },
      func: extractReleaseOrderedProductsFromDocument,
    });
    const releaseProducts = Array.isArray(releaseResult?.result)
      ? releaseResult.result
      : [];

    return queueSearchPage(pageNumber, results, releaseProducts);
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "auto-add:start") {
      resetDiscoveryState(message.sourceUrl);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.updateStatus?.newValue) return;
    const state = changes.updateStatus.newValue.state;
    if (!["completed", "blocked", "cancelled", "error", "idle"].includes(state)) return;

    releaseDiscoveryActive = false;
    for (const pending of pendingSearchPages.values()) {
      clearTimeout(pending.timeout);
      pending.resolve(pending.results);
    }
    pendingSearchPages.clear();
  });

  importScripts("safe-background.js");
})();
