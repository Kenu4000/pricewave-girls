(() => {
  importScripts("crawl-policy.js");

  const refreshPolicy = globalThis.PricewaveCrawlPolicy;
  const originalSelectScheduledProducts = refreshPolicy.selectScheduledProducts.bind(refreshPolicy);
  const wrappedStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const wrappedStorageSet = chrome.storage.local.set.bind(chrome.storage.local);
  const DEFAULT_DAILY_BRAND_SETTINGS = {
    dailyCrawlBrandOverrideEnabled: false,
    dailyCrawlBrands: [],
  };

  function applyDailyBrandSettings(stored) {
    globalThis.PricewaveDailyBrandOverride = {
      enabled: Boolean(stored?.dailyCrawlBrandOverrideEnabled),
      brands: Array.isArray(stored?.dailyCrawlBrands)
        ? stored.dailyCrawlBrands.map((brand) => String(brand).trim()).filter(Boolean)
        : [],
    };
  }

  refreshPolicy.selectScheduledProducts = (
    products,
    value,
    exactDailyUrls,
    dailyBrandOverride,
  ) => originalSelectScheduledProducts(
    products,
    value,
    exactDailyUrls,
    dailyBrandOverride ?? globalThis.PricewaveDailyBrandOverride,
  );

  const dailyBrandSettingsReady = wrappedStorageGet(DEFAULT_DAILY_BRAND_SETTINGS)
    .then(applyDailyBrandSettings)
    .catch(() => {
      applyDailyBrandSettings(DEFAULT_DAILY_BRAND_SETTINGS);
    });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes.dailyCrawlBrandOverrideEnabled && !changes.dailyCrawlBrands) return;

    const current = globalThis.PricewaveDailyBrandOverride || {
      enabled: false,
      brands: [],
    };
    applyDailyBrandSettings({
      dailyCrawlBrandOverrideEnabled:
        changes.dailyCrawlBrandOverrideEnabled?.newValue ?? current.enabled,
      dailyCrawlBrands: changes.dailyCrawlBrands?.newValue ?? current.brands,
    });
  });

  function localDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function requestsPopularSnapshot(keys) {
    if (typeof keys === "string") return keys === "popularDailyProductDate";
    if (Array.isArray(keys)) return keys.includes("popularDailyProductDate");
    if (keys && typeof keys === "object") {
      return Object.prototype.hasOwnProperty.call(keys, "popularDailyProductDate");
    }
    return false;
  }

  function expandedPopularSnapshotKeys(keys) {
    const extras = [
      "popularDailyProductAttemptDate",
      "popularDailyProductScanError",
      "updateStatus",
    ];

    if (Array.isArray(keys)) return [...new Set([...keys, ...extras])];
    if (typeof keys === "string") return [keys, ...extras];
    if (keys && typeof keys === "object") {
      return Object.assign({}, keys, {
        popularDailyProductAttemptDate: null,
        popularDailyProductScanError: null,
        updateStatus: null,
      });
    }
    return keys;
  }

  chrome.storage.local.get = async (...args) => {
    const keys = args[0];
    if (!requestsPopularSnapshot(keys)) return wrappedStorageGet(...args);

    const stored = await wrappedStorageGet(expandedPopularSnapshotKeys(keys));
    const inferredFailedAttemptDate =
      !stored.popularDailyProductAttemptDate &&
      stored.popularDailyProductScanError &&
      Number.isFinite(stored.updateStatus?.lastRunAt)
        ? localDateKey(new Date(stored.updateStatus.lastRunAt))
        : null;
    const lastAttemptDate =
      stored.popularDailyProductAttemptDate ||
      inferredFailedAttemptDate ||
      stored.popularDailyProductDate;

    if (!refreshPolicy.shouldRefreshPopularSnapshot(lastAttemptDate, new Date())) {
      stored.popularDailyProductDate = localDateKey();
    }

    delete stored.popularDailyProductAttemptDate;
    delete stored.popularDailyProductScanError;
    delete stored.updateStatus;
    return stored;
  };

  chrome.storage.local.set = async (items) => {
    const nextItems = { ...items };
    if (Object.prototype.hasOwnProperty.call(nextItems, "popularDailyProductScanError")) {
      nextItems.popularDailyProductAttemptDate = localDateKey();
    }
    return wrappedStorageSet(nextItems);
  };

  importScripts("safe-background.js");

  const safeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (...args) => {
    await dailyBrandSettingsReady;
    return safeFetch(...args);
  };
})();
