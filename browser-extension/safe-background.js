importScripts("crawl-policy.js");

const policy = globalThis.PricewaveCrawlPolicy;
const originalFetch = globalThis.fetch.bind(globalThis);
const originalStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
const originalTabsCreate = chrome.tabs.create.bind(chrome.tabs);
const originalTabsRemove = chrome.tabs.remove.bind(chrome.tabs);
const originalExecuteScript = chrome.scripting.executeScript.bind(chrome.scripting);

let taskMode = "idle";
let productStartIntervalMs = policy.MIN_PRODUCT_START_INTERVAL_MS;
let activeManagedTabId = null;
let nextManagedTabAt = 0;
let pumpTimer = null;
let temporaryFailureCount = 0;
const managedTabQueue = [];

function isLocalProductsRequest(rawUrl) {
  try {
    const url = new URL(typeof rawUrl === "string" ? rawUrl : rawUrl.url);
    return (
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.port === "3000" &&
      url.pathname === "/api/products"
    );
  } catch {
    return false;
  }
}

function isSurugayaUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.hostname === "suruga-ya.jp" || url.hostname.endsWith(".suruga-ya.jp");
  } catch {
    return false;
  }
}

function managedTabIds(tabIds) {
  return Array.isArray(tabIds) ? tabIds : [tabIds];
}

function schedulePump() {
  if (pumpTimer || activeManagedTabId !== null || managedTabQueue.length === 0) return;
  const waitMs = Math.max(0, nextManagedTabAt - Date.now());
  pumpTimer = setTimeout(() => {
    pumpTimer = null;
    void pumpManagedTabs();
  }, waitMs);
}

async function pumpManagedTabs() {
  if (activeManagedTabId !== null || managedTabQueue.length === 0) return;
  if (Date.now() < nextManagedTabAt) {
    schedulePump();
    return;
  }

  const queued = managedTabQueue.shift();
  try {
    const tab = await originalTabsCreate(queued.createProperties);
    if (!tab?.id) throw new Error("自動巡回用のタブを作成できませんでした。");
    activeManagedTabId = tab.id;
    nextManagedTabAt = Date.now() + productStartIntervalMs;
    queued.resolve(tab);
  } catch (error) {
    queued.reject(error);
    schedulePump();
  }
}

function releaseManagedTab(tabId) {
  if (tabId !== activeManagedTabId) return;
  activeManagedTabId = null;
  schedulePump();
}

chrome.storage.local.get = async (...args) => {
  const stored = await originalStorageGet(...args);
  if (stored && Object.prototype.hasOwnProperty.call(stored, "parallelTabs")) {
    stored.parallelTabs = 1;
  }
  return stored;
};

chrome.tabs.create = (createProperties) => {
  if (!isSurugayaUrl(createProperties?.url)) {
    return originalTabsCreate(createProperties);
  }

  return new Promise((resolve, reject) => {
    managedTabQueue.push({ createProperties, resolve, reject });
    schedulePump();
  });
};

chrome.tabs.remove = async (tabIds) => {
  try {
    return await originalTabsRemove(tabIds);
  } finally {
    for (const tabId of managedTabIds(tabIds)) releaseManagedTab(tabId);
  }
};

chrome.tabs.onRemoved.addListener((tabId) => releaseManagedTab(tabId));

chrome.scripting.executeScript = async (injection) => {
  const results = await originalExecuteScript(injection);

  for (const result of results ?? []) {
    const page = result?.result;
    if (!page || typeof page !== "object") continue;

    const classification = policy.classifyPage(page);
    if (classification === "blocked") {
      page.isAccessChallenge = true;
      temporaryFailureCount = 0;
      continue;
    }

    if (classification === "temporary") {
      temporaryFailureCount += 1;
      const delayMs = policy.serverRetryDelay(temporaryFailureCount);
      nextManagedTabAt = Math.max(nextManagedTabAt, Date.now() + delayMs);
      await chrome.storage.local.set({
        safeCrawlPausedUntil: nextManagedTabAt,
      });
      throw new Error(
        `駿河屋側の一時的なサーバーエラーを検出しました。${Math.ceil(delayMs / 60_000)}分待機します。`,
      );
    }

    temporaryFailureCount = 0;
  }

  return results;
};

globalThis.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  const method = String(init?.method ?? (typeof input === "object" ? input.method : "GET") ?? "GET").toUpperCase();

  if (method === "GET" && isLocalProductsRequest(input)) {
    const stored = await originalStorageGet("updateStatus");
    const statusMessage = stored.updateStatus?.message ?? "";
    const fullProductRun =
      taskMode === "full-products" || statusMessage === "登録商品を読み込んでいます。";

    if (fullProductRun && response.ok) {
      const body = await response.clone().json().catch(() => null);
      const productCount = Array.isArray(body?.products) ? body.products.length : 0;
      productStartIntervalMs = policy.calculateProductStartInterval(productCount);
      await chrome.storage.local.set({
        safeCrawlIntervalMs: productStartIntervalMs,
        safeCrawlEstimatedCompletionAt:
          Date.now() + Math.max(0, productCount - 1) * productStartIntervalMs,
      });
    }
  }

  return response;
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "auto:run-now") taskMode = "full-products";
  if (message?.type === "auto-add:start") {
    taskMode = "auto-add";
    productStartIntervalMs = policy.MIN_PRODUCT_START_INTERVAL_MS;
  }
  if (message?.type === "task:cancel") taskMode = "idle";
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (["surugaya-daily-update", "surugaya-daily-update-retry"].includes(alarm.name)) {
    taskMode = "full-products";
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.updateStatus?.newValue) return;
  const state = changes.updateStatus.newValue.state;
  const message = changes.updateStatus.newValue.message;
  if (state === "running" && message === "登録商品を読み込んでいます。") {
    taskMode = "full-products";
  }
  if (["completed", "blocked", "cancelled", "error", "idle"].includes(state)) {
    taskMode = "idle";
    productStartIntervalMs = policy.MIN_PRODUCT_START_INTERVAL_MS;
  }
});

importScripts("background.js");
