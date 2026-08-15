(() => {
  importScripts("crawl-policy.js");

  const refreshPolicy = globalThis.PricewaveCrawlPolicy;
  const wrappedStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const wrappedStorageSet = chrome.storage.local.set.bind(chrome.storage.local);
  const VALID_INTERVALS = new Set([1, 3, 7, 14]);
  const DAY_MS = 24 * 60 * 60 * 1_000;
  let manualFullRun = false;

  function isDue(product, now = Date.now()) {
    const interval = Number(product?.crawlIntervalDays);
    if (product?.crawlIntervalDays === null || !VALID_INTERVALS.has(interval)) return false;
    if (!product?.lastCheckedAt) return true;
    const lastCheckedAt = Date.parse(product.lastCheckedAt);
    if (!Number.isFinite(lastCheckedAt)) return true;
    return now - lastCheckedAt >= interval * DAY_MS;
  }

  // 日次ブランド・人気順・3分割ローテーションは廃止。
  // 自動実行は商品ごとの周期だけ、手動実行は登録リスト全件を対象にする。
  refreshPolicy.selectScheduledProducts = (products, value = Date.now()) => {
    const source = Array.isArray(products) ? products : [];
    const now = value instanceof Date ? value.getTime() : Number(value);
    const selected = manualFullRun ? source : source.filter((product) => isDue(product, now));
    return {
      products: selected,
      bucket: null,
      dailyCount: selected.length,
      exactDailyCount: 0,
      rotationCount: 0,
      totalRegistered: source.length,
      customDailyBrandCount: null,
    };
  };

  // safe-background に残る旧人気順スナップショット処理は、巡回対象の決定にはもう不要。
  // キャッシュ日を常に本日扱いにして追加の人気順ページ巡回を発生させない。
  refreshPolicy.shouldRefreshPopularSnapshot = () => false;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "auto:run-now") manualFullRun = true;
    if (message?.type === "task:cancel" || message?.type === "auto-add:start") manualFullRun = false;
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (["surugaya-daily-update", "surugaya-daily-update-retry"].includes(alarm.name)) {
      manualFullRun = false;
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.updateStatus?.newValue) return;
    if (["completed", "blocked", "cancelled", "error", "idle"].includes(changes.updateStatus.newValue.state)) {
      manualFullRun = false;
    }
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
    if (keys && typeof keys === "object") return Object.prototype.hasOwnProperty.call(keys, "popularDailyProductDate");
    return false;
  }

  function expandedPopularSnapshotKeys(keys) {
    const extras = ["popularDailyProductAttemptDate", "popularDailyProductScanError", "updateStatus"];
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
    stored.popularDailyProductDate = localDateKey();
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

  importScripts("new-product-discovery-wrapper.js");
})();
