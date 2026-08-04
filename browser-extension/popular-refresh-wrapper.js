importScripts("crawl-policy.js");

const policy = globalThis.PricewaveCrawlPolicy;
const originalStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
const originalStorageSet = chrome.storage.local.set.bind(chrome.storage.local);

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
  if (!requestsPopularSnapshot(keys)) return originalStorageGet(...args);

  const stored = await originalStorageGet(expandedPopularSnapshotKeys(keys));
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

  if (!policy.shouldRefreshPopularSnapshot(lastAttemptDate, new Date())) {
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
  return originalStorageSet(nextItems);
};

importScripts("safe-background.js");
