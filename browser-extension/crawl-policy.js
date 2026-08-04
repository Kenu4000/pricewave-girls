(function exposePricewaveCrawlPolicy(globalObject) {
  const DAY_MS = 24 * 60 * 60 * 1_000;
  const ROTATION_DAYS = 3;
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

  function localDayNumber(value = Date.now()) {
    const date = value instanceof Date ? value : new Date(value);
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  }

  function rotationBucket(value = Date.now()) {
    const remainder = localDayNumber(value) % ROTATION_DAYS;
    return remainder < 0 ? remainder + ROTATION_DAYS : remainder;
  }

  function productRotationBucket(product) {
    const numericId = Math.floor(Math.abs(Number(product?.id) || 0));
    return numericId % ROTATION_DAYS;
  }

  function normalizeProductUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      const match = url.pathname.match(/^\/product\/detail\/([0-9]+)\/?$/u);
      return match ? `https://www.suruga-ya.jp/product/detail/${match[1]}` : "";
    } catch {
      return "";
    }
  }

  function selectScheduledProducts(products, value = Date.now(), exactDailyUrls = []) {
    const source = Array.isArray(products) ? products : [];
    const bucket = rotationBucket(value);
    const exactDailySet = new Set(
      (Array.isArray(exactDailyUrls) ? exactDailyUrls : [])
        .map(normalizeProductUrl)
        .filter(Boolean),
    );
    const daily = [];
    const rotation = [];
    let exactDailyCount = 0;

    for (const product of source) {
      const exactDaily = exactDailySet.has(normalizeProductUrl(product?.url));
      if (product?.crawlPriority === "daily" || exactDaily) {
        daily.push(product);
        if (exactDaily && product?.crawlPriority !== "daily") exactDailyCount += 1;
      } else if (productRotationBucket(product) === bucket) {
        rotation.push(product);
      }
    }

    return {
      products: [...daily, ...rotation],
      bucket,
      dailyCount: daily.length,
      exactDailyCount,
      rotationCount: rotation.length,
      totalRegistered: source.length,
    };
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
    ROTATION_DAYS,
    MIN_PRODUCT_START_INTERVAL_MS,
    MAX_PRODUCT_START_INTERVAL_MS,
    calculateProductStartInterval,
    localDayNumber,
    rotationBucket,
    productRotationBucket,
    normalizeProductUrl,
    selectScheduledProducts,
    classifyPage,
    serverRetryDelay,
  };

  globalObject.PricewaveCrawlPolicy = policy;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = policy;
  }
})(typeof globalThis === "undefined" ? self : globalThis);
