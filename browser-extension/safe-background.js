importScripts("crawl-policy.js");

const policy = globalThis.PricewaveCrawlPolicy;
const originalFetch = globalThis.fetch.bind(globalThis);
const originalStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
const originalTabsCreate = chrome.tabs.create.bind(chrome.tabs);
const originalTabsRemove = chrome.tabs.remove.bind(chrome.tabs);
const originalExecuteScript = chrome.scripting.executeScript.bind(chrome.scripting);

const POPULAR_SEARCH_TARGETS = [
  { category: "600", pages: 10 },
  { category: "652042222", pages: 15 },
];
const POPULAR_PAGE_SETTLE_MS = 2_500;
const POPULAR_PAGE_TIMEOUT_MS = 60_000;

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

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function managedTabIds(tabIds) {
  return Array.isArray(tabIds) ? tabIds : [tabIds];
}

function jsonResponse(response, body) {
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.delete("content-length");
  return new Response(JSON.stringify(body), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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

function waitForManagedTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(
      () => finish(new Error("人気順ページの読込がタイムアウトしました。")),
      POPULAR_PAGE_TIMEOUT_MS,
    );

    function cleanup() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    }

    function finish(error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    }

    function onUpdated(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish();
    }

    function onRemoved(removedTabId) {
      if (removedTabId === tabId) finish(new Error("人気順ページのタブが閉じられました。"));
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch((error) => finish(error));
  });
}

async function readPopularProductUrls(pageUrl) {
  const tab = await chrome.tabs.create({ url: pageUrl, active: false });
  if (!tab?.id) throw new Error("人気順ページを開けませんでした。");

  try {
    await waitForManagedTabComplete(tab.id);
    await sleep(POPULAR_PAGE_SETTLE_MS);
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const isAccessChallenge =
          /^(Just a moment|Attention Required)/i.test(document.title.trim()) ||
          Boolean(
            document.querySelector(
              "#challenge-running, #cf-challenge-running, form#challenge-form",
            ),
          );
        const productUrls = [...document.querySelectorAll("a[href]")]
          .map((anchor) => {
            try {
              const url = new URL(anchor.getAttribute("href"), window.location.href);
              const match = url.pathname.match(/^\/product\/detail\/([0-9]+)\/?$/);
              return match
                ? `https://www.suruga-ya.jp/product/detail/${match[1]}`
                : null;
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        return {
          title: document.title,
          bodyText: document.body?.innerText || "",
          isAccessChallenge,
          productUrls: [...new Set(productUrls)],
        };
      },
    });
    const page = injection?.result;
    if (!page || page.isAccessChallenge) {
      throw new Error("人気順ページでアクセス確認を検出しました。");
    }
    return Array.isArray(page.productUrls) ? page.productUrls : [];
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function popularDailyProductUrls() {
  const today = localDateKey();
  const stored = await originalStorageGet([
    "popularDailyProductDate",
    "popularDailyProductUrls",
  ]);
  const cachedUrls = Array.isArray(stored.popularDailyProductUrls)
    ? stored.popularDailyProductUrls
    : [];

  if (stored.popularDailyProductDate === today) return cachedUrls;

  const urls = new Set();
  try {
    for (const target of POPULAR_SEARCH_TARGETS) {
      for (let page = 1; page <= target.pages; page += 1) {
        const url = new URL("https://www.suruga-ya.jp/search");
        url.searchParams.set("category", target.category);
        url.searchParams.set("search_word", "");
        url.searchParams.set("page", String(page));
        for (const productUrl of await readPopularProductUrls(url.toString())) {
          urls.add(productUrl);
        }
      }
    }

    const result = [...urls];
    await chrome.storage.local.set({
      popularDailyProductDate: today,
      popularDailyProductUrls: result,
      popularDailyProductScannedAt: Date.now(),
      popularDailyProductScanError: null,
    });
    return result;
  } catch (error) {
    await chrome.storage.local.set({
      popularDailyProductScanError:
        error instanceof Error ? error.message : "人気順ページの取得に失敗しました。",
    });
    return cachedUrls;
  }
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
  const method = String(
    init?.method ?? (typeof input === "object" ? input.method : "GET") ?? "GET",
  ).toUpperCase();

  if (method === "GET" && isLocalProductsRequest(input)) {
    const stored = await originalStorageGet("updateStatus");
    const statusMessage = stored.updateStatus?.message ?? "";
    const scheduledProductRun =
      taskMode === "full-products" || statusMessage === "登録商品を読み込んでいます。";

    if (scheduledProductRun && response.ok) {
      const body = await response.clone().json().catch(() => null);
      if (Array.isArray(body?.products)) {
        const popularUrls = await popularDailyProductUrls();
        const plan = policy.selectScheduledProducts(
          body.products,
          new Date(),
          popularUrls,
        );
        const productCount = plan.products.length;
        productStartIntervalMs = policy.calculateProductStartInterval(productCount);
        await chrome.storage.local.set({
          safeCrawlIntervalMs: productStartIntervalMs,
          safeCrawlEstimatedCompletionAt:
            Date.now() + Math.max(0, productCount - 1) * productStartIntervalMs,
          safeCrawlPlan: {
            rotationBucket: plan.bucket,
            dailyCount: plan.dailyCount,
            exactPopularCount: plan.exactDailyCount,
            rotationCount: plan.rotationCount,
            selectedCount: productCount,
            totalRegistered: plan.totalRegistered,
            popularSnapshotCount: popularUrls.length,
            plannedAt: Date.now(),
          },
        });
        return jsonResponse(response, {
          ...body,
          products: plan.products,
          crawlPlan: {
            rotationBucket: plan.bucket,
            dailyCount: plan.dailyCount,
            exactPopularCount: plan.exactDailyCount,
            rotationCount: plan.rotationCount,
            selectedCount: productCount,
            totalRegistered: plan.totalRegistered,
            popularSnapshotCount: popularUrls.length,
          },
        });
      }
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
