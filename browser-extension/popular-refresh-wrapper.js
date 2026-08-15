(() => {
  importScripts("crawl-policy.js", "balanced-crawl-scheduler.js");

  const refreshPolicy = globalThis.PricewaveCrawlPolicy;
  const balancedScheduler = globalThis.PricewaveBalancedCrawlScheduler;
  const wrappedStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const wrappedStorageSet = chrome.storage.local.set.bind(chrome.storage.local);
  let manualFullRun = false;

  // 日次ブランド・人気順・3分割ローテーションは廃止。
  // 自動実行は1日周期を毎日対象にし、3/7/14日周期は理論巡回数を日ごとに均等化する。
  // 手動実行は周期に関係なく登録リスト全件を対象にする。
  refreshPolicy.selectScheduledProducts = (products, value = Date.now()) => {
    const source = Array.isArray(products) ? products : [];
    if (manualFullRun) {
      return {
        products: source,
        bucket: null,
        dailyCount: source.length,
        exactDailyCount: 0,
        rotationCount: 0,
        totalRegistered: source.length,
        customDailyBrandCount: null,
      };
    }

    const plan = balancedScheduler.selectBalancedProducts(source, value);
    return {
      products: plan.products,
      bucket: null,
      dailyCount: plan.dailyCount,
      exactDailyCount: 0,
      rotationCount: plan.balancedCount,
      totalRegistered: source.length,
      customDailyBrandCount: null,
      balancedTarget: plan.balancedTarget,
      deferredCount: plan.deferredCount,
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
