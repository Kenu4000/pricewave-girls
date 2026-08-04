(function exposePricewaveCrawlPolicy(globalObject) {
  const DAY_MS = 24 * 60 * 60 * 1_000;
  const MIN_PRODUCT_START_INTERVAL_MS = 8_000;
  const MAX_PRODUCT_START_INTERVAL_MS = 25_000;
  const SERVER_RETRY_DELAYS_MS = [
    10 * 60 * 1_000,
    30 * 60 * 1_000,
    2 * 60 * 60 * 1_000,
  ];

  function calculateProductStartInterval(productCount) {
    const normalizedCount = Math.max(1, Math.floor(Number(productCount) || 1));
    const distributedInterval = Math.floor(DAY_MS / normalizedCount);
    return Math.min(
      MAX_PRODUCT_START_INTERVAL_MS,
      Math.max(MIN_PRODUCT_START_INTERVAL_MS, distributedInterval),
    );
  }

  function normalizedPageText(page) {
    return [page?.title, page?.bodyText, page?.html]
      .filter((value) => typeof value === "string")
      .join("\n")
      .normalize("NFKC")
      .toLocaleLowerCase("en");
  }

  function classifyPage(page) {
    if (page?.isAccessChallenge) return "blocked";

    const text = normalizedPageText(page);
    if (
      /just a moment|attention required|cf-chl-|challenge-platform/u.test(text) ||
      /(?:^|\D)429(?:\D|$)|too many requests|rate limit|アクセスが集中|時間をおいてアクセス/u.test(
        text,
      ) ||
      /403 forbidden|access denied|アクセスを拒否|このページへのアクセスは制限/u.test(text)
    ) {
      return "blocked";
    }

    if (
      /500 internal server error|502 bad gateway|503 service unavailable|504 gateway timeout/u.test(
        text,
      ) ||
      /サーバーエラー|一時的にご利用いただけません|メンテナンス中/u.test(text)
    ) {
      return "temporary";
    }

    return "ok";
  }

  function serverRetryDelay(failureCount) {
    const index = Math.min(
      SERVER_RETRY_DELAYS_MS.length - 1,
      Math.max(0, Math.floor(Number(failureCount) || 1) - 1),
    );
    return SERVER_RETRY_DELAYS_MS[index];
  }

  const policy = {
    DAY_MS,
    MIN_PRODUCT_START_INTERVAL_MS,
    MAX_PRODUCT_START_INTERVAL_MS,
    calculateProductStartInterval,
    classifyPage,
    serverRetryDelay,
  };

  globalObject.PricewaveCrawlPolicy = policy;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = policy;
  }
})(typeof globalThis === "undefined" ? self : globalThis);
