(() => {
  importScripts("crawl-policy.js", "balanced-crawl-scheduler.js");

  const refreshPolicy = globalThis.PricewaveCrawlPolicy;
  const balancedScheduler = globalThis.PricewaveBalancedCrawlScheduler;
  const wrappedStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const wrappedStorageSet = chrome.storage.local.set.bind(chrome.storage.local);
  let manualFullRun = false;
  let cachedAutomaticPlan = null;

  function localDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function intervalSignature(products) {
    return products
      .map((product) => {
        const id = Number(product?.id) || 0;
        const interval = product?.crawlIntervalDays === null
          ? "off"
          : String(product?.crawlIntervalDays ?? "missing");
        return `${id}:${interval}`;
      })
      .join("|");
  }

  function dateKeyForValue(value) {
    if (value instanceof Date) return localDateKey(value);
    const timestamp = Number(value);
    return localDateKey(Number.isFinite(timestamp) ? new Date(timestamp) : new Date());
  }

  function reuseCachedPlan(source, signature, dateKey) {
    if (
      !cachedAutomaticPlan ||
      cachedAutomaticPlan.signature !== signature ||
      cachedAutomaticPlan.dateKey !== dateKey
    ) {
      return null;
    }

    const productById = new Map(
      source.map((product) => [Number(product?.id) || 0, product]),
    );
    const products = cachedAutomaticPlan.productIds
      .map((id) => productById.get(id))
      .filter(Boolean);

    if (products.length !== cachedAutomaticPlan.productIds.length) return null;
    return {
      products,
      dailyCount: cachedAutomaticPlan.dailyCount,
      balancedCount: cachedAutomaticPlan.balancedCount,
      balancedTarget: cachedAutomaticPlan.balancedTarget,
      deferredCount: cachedAutomaticPlan.deferredCount,
      totalRegistered: source.length,
    };
  }

  function selectAutomaticProducts(source, value) {
    const signature = intervalSignature(source);
    const dateKey = dateKeyForValue(value);
    const reused = reuseCachedPlan(source, signature, dateKey);
    if (reused) return reused;

    const plan = balancedScheduler.selectBalancedProducts(source, value);
    cachedAutomaticPlan = {
      signature,
      dateKey,
      productIds: plan.products.map((product) => Number(product?.id) || 0),
      dailyCount: plan.dailyCount,
      balancedCount: plan.balancedCount,
      balancedTarget: plan.balancedTarget,
      deferredCount: plan.deferredCount,
    };
    return plan;
  }

  // 日次ブランド・人気順・3分割ローテーションは廃止。
  // 自動実行は巡回開始時に全商品の周期を一括確認する。
  // 同日中は周期構成に変更がなければ既存プランを再利用し、変更があれば均等化を再計算する。
  // 手動全件更新も「無」は対象外にする。
  refreshPolicy.selectScheduledProducts = (products, value = Date.now()) => {
    const source = Array.isArray(products) ? products : [];
    if (manualFullRun) {
      const enabledProducts = source.filter(
        (product) => product?.crawlIntervalDays !== null,
      );
      return {
        products: enabledProducts,
        bucket: null,
        dailyCount: enabledProducts.length,
        exactDailyCount: 0,
        rotationCount: 0,
        totalRegistered: source.length,
        customDailyBrandCount: null,
      };
    }

    const plan = selectAutomaticProducts(source, value);
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
