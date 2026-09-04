(() => {
  const originalReadSearchPage = readSearchPage;
  const discoveryPolicy = globalThis.PricewaveNewProductDiscoveryPolicy;
  if (!discoveryPolicy?.isConditionVariantTitle) return;

  function extractProductTitlesFromDocument() {
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

    function titleCandidate(anchor) {
      const candidates = [
        anchor.getAttribute("title"),
        anchor.getAttribute("aria-label"),
        anchor.querySelector("img")?.getAttribute("alt"),
        anchor.innerText,
        anchor.textContent,
      ]
        .map((value) => String(value || "").replace(/\s+/gu, " ").trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);
      return candidates[0] || "";
    }

    const products = new Map();
    for (const anchor of document.querySelectorAll("a[href]")) {
      const url = canonicalProductUrl(anchor.getAttribute("href"));
      if (!url) continue;
      const title = titleCandidate(anchor);
      const current = products.get(url) || "";
      if (title.length > current.length) products.set(url, title);
      else if (!products.has(url)) products.set(url, current);
    }
    return [...products].map(([url, title]) => ({ url, title }));
  }

  readSearchPage = async function readSearchPageWithoutConditionVariants(tabId) {
    const page = await originalReadSearchPage(tabId);
    if (!Array.isArray(page?.productUrls) || page.productUrls.length === 0) return page;

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractProductTitlesFromDocument,
    });
    const products = Array.isArray(injection?.result) ? injection.result : [];
    const conditionUrls = new Set(
      products
        .filter((product) => discoveryPolicy.isConditionVariantTitle(product?.title))
        .map((product) => product.url),
    );
    if (conditionUrls.size === 0) return page;

    return {
      ...page,
      productUrls: page.productUrls.filter((url) => !conditionUrls.has(url)),
    };
  };
})();
