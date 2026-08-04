const AUTO_UPDATE_ALARM = "surugaya-daily-update";
const AUTO_UPDATE_RETRY_ALARM = "surugaya-daily-update-retry";
const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const UPDATE_INTERVAL_MS = 1_000;
const PAGE_LOAD_TIMEOUT_MS = 60_000;
const DEFAULT_AUTO_ADD_URL =
  "https://www.suruga-ya.jp/search?category=65204&genre2=%E3%83%93%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%AB%E3%83%8E%E3%83%99%E3%83%AB%28%E7%BE%8E%E5%B0%91%E5%A5%B3%E3%82%B2%E3%83%BC%E3%83%A0%29&search_word=";
const DEFAULT_AUTO_ADD_LIMIT = 1_000;
const DEFAULT_PARALLEL_TABS = 10;
const DEFAULT_SETTINGS = {
  autoUpdateEnabled: false,
  autoUpdateTime: "09:00",
  parallelTabs: DEFAULT_PARALLEL_TABS,
};
const DEFAULT_STATUS = {
  state: "idle",
  current: 0,
  total: 0,
  succeeded: 0,
  failed: 0,
  message: "自動更新は待機中です。",
  updatedAt: null,
  lastRunAt: null,
};

let currentRun = null;
let cancelRequested = false;

class AccessChallengeError extends Error {}
class TaskCancelledError extends Error {}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertTaskContinues() {
  if (cancelRequested) {
    throw new TaskCancelledError("処理を停止しました。");
  }
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseTime(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(time || "");
  if (!match) {
    return { hour: 9, minute: 0 };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return { hour: 9, minute: 0 };
  }
  return { hour, minute };
}

function nextRunAt(time, now = new Date()) {
  const { hour, minute } = parseTime(time);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return {
    autoUpdateEnabled: Boolean(stored.autoUpdateEnabled),
    autoUpdateTime:
      typeof stored.autoUpdateTime === "string"
        ? stored.autoUpdateTime
        : DEFAULT_SETTINGS.autoUpdateTime,
    parallelTabs: Number.isInteger(stored.parallelTabs)
      ? Math.min(100, Math.max(1, stored.parallelTabs))
      : DEFAULT_SETTINGS.parallelTabs,
  };
}

async function getAutoAddSettings() {
  const stored = await chrome.storage.local.get(["autoAddSourceUrl", "autoAddLimit"]);
  return {
    sourceUrl:
      typeof stored.autoAddSourceUrl === "string"
        ? stored.autoAddSourceUrl
        : DEFAULT_AUTO_ADD_URL,
    limit:
      Number.isInteger(stored.autoAddLimit)
        ? Math.min(1_000, Math.max(1, stored.autoAddLimit))
        : DEFAULT_AUTO_ADD_LIMIT,
  };
}

async function getStatus() {
  const stored = await chrome.storage.local.get("updateStatus");
  return { ...DEFAULT_STATUS, ...(stored.updateStatus || {}) };
}

async function setStatus(patch) {
  const status = { ...(await getStatus()), ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ updateStatus: status });
  return status;
}

async function configureAlarm() {
  await chrome.alarms.clear(AUTO_UPDATE_ALARM);
  const settings = await getSettings();
  if (!settings.autoUpdateEnabled) {
    await chrome.alarms.clear(AUTO_UPDATE_RETRY_ALARM);
    return null;
  }

  const when = nextRunAt(settings.autoUpdateTime);
  await chrome.alarms.create(AUTO_UPDATE_ALARM, {
    when,
    periodInMinutes: 24 * 60,
  });
  return when;
}

async function requestLocal(path, options = {}) {
  let lastError = null;

  for (const origin of LOCAL_ORIGINS) {
    try {
      const response = await fetch(`${origin}${path}`, {
        ...options,
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `ローカルAPIがHTTP ${response.status}を返しました。`);
      }
      return { result, origin };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `駿河屋価格トラッキングに接続できません: ${lastError.message}`
      : "駿河屋価格トラッキングに接続できません。",
  );
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => finish(new Error("商品ページの読込がタイムアウトしました。")), PAGE_LOAD_TIMEOUT_MS);

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
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        finish();
      }
    }

    function onRemoved(removedTabId) {
      if (removedTabId === tabId) {
        finish(new Error("自動更新用の商品タブが閉じられました。"));
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch((error) => finish(error));
  });
}

async function readProductPage(tabId) {
  await waitForTabComplete(tabId);
  await sleep(2_500);

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      url: window.location.href,
      html: document.documentElement?.outerHTML || "",
      title: document.title,
      isAccessChallenge:
        /^(Just a moment|Attention Required)/i.test(document.title.trim()) ||
        Boolean(
          document.querySelector(
            "#challenge-running, #cf-challenge-running, form#challenge-form",
          ),
        ),
    }),
  });
  const page = injection?.result;

  if (
    !page?.html ||
    page.isAccessChallenge
  ) {
    throw new AccessChallengeError(
      "駿河屋のアクセス確認が表示されたため、自動更新を停止しました。",
    );
  }

  return page;
}

function normalizeSearchUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("駿河屋の検索結果URLを入力してください。");
  }

  const isSurugaya =
    url.hostname === "suruga-ya.jp" || url.hostname.endsWith(".suruga-ya.jp");
  if (!isSurugaya || !["http:", "https:"].includes(url.protocol) || url.pathname !== "/search") {
    throw new Error("駿河屋の検索結果URLを入力してください。");
  }

  url.protocol = "https:";
  url.hostname = "www.suruga-ya.jp";
  url.hash = "";
  return url.toString();
}

function productIdFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).pathname.match(/^\/product\/detail\/([0-9]+)\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractSearchPageFromDocument() {
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
        return match ? `https://www.suruga-ya.jp/product/detail/${match[1]}` : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const nextAnchor = [...document.querySelectorAll("a[href]")].find((anchor) =>
    /次のページ/.test(anchor.textContent?.replace(/\s+/g, "") || ""),
  );

  return {
    isAccessChallenge,
    productUrls: [...new Set(productUrls)],
    nextUrl: nextAnchor ? new URL(nextAnchor.href, window.location.href).toString() : null,
  };
}

async function readSearchPage(tabId) {
  await waitForTabComplete(tabId);
  await sleep(2_500);

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractSearchPageFromDocument,
  });
  const page = injection?.result;
  if (!page || page.isAccessChallenge) {
    throw new AccessChallengeError(
      "駿河屋のアクセス確認が表示されたため、自動追加を停止しました。",
    );
  }
  return page;
}

async function readSearchPageAtUrl(pageUrl) {
  const tab = await chrome.tabs.create({ url: pageUrl, active: false });
  if (!tab.id) throw new Error("検索結果を開くタブを作成できませんでした。");

  try {
    return await readSearchPage(tab.id);
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function collectUnregisteredProducts(
  sourceUrl,
  limit,
  registeredIds,
  requestedParallelTabs,
) {
  const collected = [];
  const collectedIds = new Set();
  const baseUrl = new URL(normalizeSearchUrl(sourceUrl));
  let pageNumber = Math.max(1, Number(baseUrl.searchParams.get("page")) || 1);
  const parallelTabs = Math.min(100, Math.max(1, Number(requestedParallelTabs) || 1));
  let reachedLastPage = false;

  while (collected.length < limit && !reachedLastPage) {
    assertTaskContinues();
    const remaining = limit - collected.length;
    const pagesNeeded = Math.max(1, Math.ceil(remaining / 24));
    const batchSize = Math.min(parallelTabs, pagesNeeded);
    const pageNumbers = Array.from({ length: batchSize }, (_, index) => pageNumber + index);
    await setStatus({
      message: `一覧${pageNumbers[0]}〜${pageNumbers.at(-1)}ページを確認中: 未登録${collected.length}/${limit}件`,
    });

    const pages = await Promise.all(
      pageNumbers.map((currentPage) => {
        const pageUrl = new URL(baseUrl);
        pageUrl.searchParams.set("page", String(currentPage));
        return readSearchPageAtUrl(pageUrl.toString());
      }),
    );

    for (const page of pages) {
      for (const productUrl of page.productUrls) {
        const id = productIdFromUrl(productUrl);
        if (!id || registeredIds.has(id) || collectedIds.has(id)) continue;
        collectedIds.add(id);
        collected.push({ id, url: productUrl });
        if (collected.length >= limit) break;
      }
      if (!page.nextUrl || collected.length >= limit) {
        reachedLastPage = !page.nextUrl;
        break;
      }
    }

    pageNumber += batchSize;
    if (!reachedLastPage && collected.length < limit) await sleep(UPDATE_INTERVAL_MS);
  }

  return collected;
}

async function updateOneProduct(product, sessionId = null) {
  const tab = await chrome.tabs.create({ url: product.url, active: false });
  if (!tab.id) {
    throw new Error("自動更新用のタブを作成できませんでした。");
  }

  try {
    const page = await readProductPage(tab.id);
    await requestLocal("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: page.url, html: page.html, sessionId }),
    });
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function processProductsAndCommit(products, requestedParallelTabs, describeProduct) {
  const sessionId = crypto.randomUUID();
  let result = { succeeded: 0, failed: 0 };
  let processingError = null;

  try {
    result = await processProductsInParallel(
      products,
      requestedParallelTabs,
      describeProduct,
      (product) => updateOneProduct(product, sessionId),
    );
  } catch (error) {
    processingError = error;
    result = {
      succeeded: Number.isInteger(error?.succeeded) ? error.succeeded : 0,
      failed: Number.isInteger(error?.failed) ? error.failed : 0,
    };
  }

  if (result.succeeded > 0) {
    await setStatus({
      succeeded: result.succeeded,
      failed: result.failed,
      message: `取得済み${result.succeeded}件の残りをデータベースへ保存しています。`,
    });
    try {
      const { result: commitResult } = await requestLocal("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (commitResult.count !== result.succeeded) {
        throw new Error(
          `一括保存件数が一致しません（取得${result.succeeded}件、保存${commitResult.count}件）`,
        );
      }
    } catch (error) {
      const commitError =
        error instanceof Error ? error : new Error("データベースへの一括保存に失敗しました。");
      commitError.succeeded = 0;
      commitError.failed = result.failed + result.succeeded;
      throw commitError;
    }
  }

  if (processingError) throw processingError;
  return result;
}

async function processProductsInParallel(
  products,
  requestedParallelTabs,
  describeProduct,
  processor = updateOneProduct,
  intervalMs = UPDATE_INTERVAL_MS,
) {
  const workerCount = Math.min(
    products.length,
    Math.min(100, Math.max(1, Number(requestedParallelTabs) || 1)),
  );
  let nextIndex = 0;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  let blockingError = null;

  const worker = async () => {
    while (!cancelRequested && !blockingError) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= products.length) return;

      const product = products[index];
      const description = describeProduct(product, index, products.length);
      await setStatus({
        current: completed,
        succeeded,
        failed,
        message: `${description}（最大${workerCount}タブ並列）`,
      });

      try {
        await processor(product);
        succeeded += 1;
      } catch (error) {
        failed += 1;
        if (error instanceof AccessChallengeError) blockingError = error;
      }

      completed += 1;
      await setStatus({
        current: completed,
        succeeded,
        failed,
        message: `${completed}/${products.length}件完了: 成功${succeeded}件、失敗${failed}件`,
      });

      if (
        intervalMs > 0 &&
        !cancelRequested &&
        !blockingError &&
        nextIndex < products.length
      ) {
        await sleep(intervalMs);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (blockingError) {
    blockingError.succeeded = succeeded;
    blockingError.failed = failed;
    throw blockingError;
  }
  if (cancelRequested) {
    const error = new TaskCancelledError("処理を停止しました。");
    error.succeeded = succeeded;
    error.failed = failed;
    throw error;
  }
  return { succeeded, failed };
}

async function runAllProducts(trigger) {
  const startedAt = Date.now();
  let succeeded = 0;
  let failed = 0;

  await setStatus({
    state: "running",
    current: 0,
    total: 0,
    succeeded: 0,
    failed: 0,
    message: "登録商品を読み込んでいます。",
    lastRunAt: startedAt,
  });

  try {
    const { result } = await requestLocal("/api/products");
    const products = Array.isArray(result.products) ? result.products : [];
    const settings = await getSettings();

    if (products.length === 0) {
      if (trigger !== "manual") {
        await chrome.storage.local.set({ lastAutoAttemptDate: localDateKey() });
      }
      await setStatus({
        state: "completed",
        message: "登録商品がないため、更新対象は0件でした。",
        total: 0,
      });
      return;
    }

    await setStatus({ total: products.length, message: `全${products.length}件を更新します。` });

    ({ succeeded, failed } = await processProductsAndCommit(
      products,
      settings.parallelTabs,
      (product, index, total) => `${index + 1}/${total}件目: ${product.title}`,
    ));

    if (trigger !== "manual") {
      await chrome.storage.local.set({ lastAutoAttemptDate: localDateKey() });
    }
    await chrome.alarms.clear(AUTO_UPDATE_RETRY_ALARM);
    await setStatus({
      state: "completed",
      current: products.length,
      succeeded,
      failed,
      message: `更新完了: 成功${succeeded}件、失敗${failed}件`,
    });
  } catch (error) {
    succeeded = Number.isInteger(error?.succeeded) ? error.succeeded : succeeded;
    failed = Number.isInteger(error?.failed) ? error.failed : failed;
    if (error instanceof AccessChallengeError) {
      if (trigger !== "manual") {
        await chrome.storage.local.set({ lastAutoAttemptDate: localDateKey() });
      }
      await setStatus({ state: "blocked", succeeded, failed, message: error.message });
      return;
    }
    if (error instanceof TaskCancelledError) {
      await setStatus({ state: "cancelled", succeeded, failed, message: error.message });
      return;
    }
    if (trigger !== "manual" && (await getSettings()).autoUpdateEnabled) {
      await chrome.alarms.create(AUTO_UPDATE_RETRY_ALARM, { delayInMinutes: 15 });
    }
    await setStatus({
      state: "error",
      succeeded,
      failed,
      message: error instanceof Error ? error.message : "自動更新に失敗しました。",
    });
  } finally {
    if (trigger !== "manual") {
      await configureAlarm();
    }
  }
}

async function runAutoAdd(sourceUrl, requestedLimit) {
  const limit = Math.min(1_000, Math.max(1, Number(requestedLimit) || 1));
  let succeeded = 0;
  let failed = 0;

  await setStatus({
    state: "running",
    current: 0,
    total: 0,
    succeeded: 0,
    failed: 0,
    message: "登録済み商品を確認しています。",
    lastRunAt: Date.now(),
  });

  try {
    const normalizedSourceUrl = normalizeSearchUrl(sourceUrl);
    const { result } = await requestLocal("/api/products");
    const settings = await getSettings();
    const registeredIds = new Set(
      (Array.isArray(result.products) ? result.products : [])
        .map((product) => productIdFromUrl(product.url))
        .filter(Boolean),
    );
    const products = await collectUnregisteredProducts(
      normalizedSourceUrl,
      limit,
      registeredIds,
      settings.parallelTabs,
    );

    if (products.length === 0) {
      await setStatus({
        state: "completed",
        message: "検索結果に未登録の商品がありませんでした。",
        total: 0,
      });
      return;
    }

    await setStatus({
      current: 0,
      total: products.length,
      message: `未登録${products.length}件を追加します。`,
    });

    ({ succeeded, failed } = await processProductsAndCommit(
      products,
      settings.parallelTabs,
      (product, index, total) => `${index + 1}/${total}件目を追加中: ${product.id}`,
    ));

    await setStatus({
      state: "completed",
      current: products.length,
      succeeded,
      failed,
      message: `自動追加完了: 成功${succeeded}件、失敗${failed}件`,
    });
  } catch (error) {
    succeeded = Number.isInteger(error?.succeeded) ? error.succeeded : succeeded;
    failed = Number.isInteger(error?.failed) ? error.failed : failed;
    await setStatus({
      state:
        error instanceof AccessChallengeError
          ? "blocked"
          : error instanceof TaskCancelledError
            ? "cancelled"
            : "error",
      succeeded,
      failed,
      message: error instanceof Error ? error.message : "自動追加に失敗しました。",
    });
  }
}

function startTask(taskFactory) {
  if (currentRun) return false;
  cancelRequested = false;
  currentRun = taskFactory().finally(() => {
    currentRun = null;
  });
  return true;
}

function startRun(trigger) {
  return startTask(() => runAllProducts(trigger));
}

async function runMissedUpdateIfNeeded() {
  const settings = await getSettings();
  if (!settings.autoUpdateEnabled) return;

  const { hour, minute } = parseTime(settings.autoUpdateTime);
  const scheduled = new Date();
  scheduled.setHours(hour, minute, 0, 0);
  const stored = await chrome.storage.local.get("lastAutoAttemptDate");

  if (Date.now() >= scheduled.getTime() && stored.lastAutoAttemptDate !== localDateKey()) {
    startRun("startup");
  }
}

async function initialize() {
  const stored = await chrome.storage.local.get([
    "autoUpdateEnabled",
    "autoUpdateTime",
    "parallelTabs",
    "autoAddSourceUrl",
    "autoAddLimit",
  ]);
  await chrome.storage.local.set({
    autoUpdateEnabled:
      typeof stored.autoUpdateEnabled === "boolean"
        ? stored.autoUpdateEnabled
        : DEFAULT_SETTINGS.autoUpdateEnabled,
    autoUpdateTime:
      typeof stored.autoUpdateTime === "string"
        ? stored.autoUpdateTime
        : DEFAULT_SETTINGS.autoUpdateTime,
    parallelTabs: Number.isInteger(stored.parallelTabs)
      ? Math.min(100, Math.max(1, stored.parallelTabs))
      : DEFAULT_SETTINGS.parallelTabs,
    autoAddSourceUrl:
      typeof stored.autoAddSourceUrl === "string"
        ? stored.autoAddSourceUrl
        : DEFAULT_AUTO_ADD_URL,
    autoAddLimit:
      Number.isInteger(stored.autoAddLimit)
        ? Math.min(1_000, Math.max(1, stored.autoAddLimit))
        : DEFAULT_AUTO_ADD_LIMIT,
  });

  const status = await getStatus();
  if (status.state === "running") {
    await setStatus({ state: "idle", message: "前回の自動更新は中断されました。" });
  }
  await configureAlarm();
}

chrome.runtime.onInstalled.addListener(() => {
  void initialize();
});

chrome.runtime.onStartup.addListener(() => {
  void initialize().then(runMissedUpdateIfNeeded);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (![AUTO_UPDATE_ALARM, AUTO_UPDATE_RETRY_ALARM].includes(alarm.name)) return;
  void chrome.storage.local.get("lastAutoAttemptDate").then((stored) => {
    if (stored.lastAutoAttemptDate !== localDateKey()) {
      startRun(alarm.name === AUTO_UPDATE_RETRY_ALARM ? "retry" : "alarm");
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    if (message?.type === "auto:get") {
      const settings = await getSettings();
      const autoAddSettings = await getAutoAddSettings();
      const status = await getStatus();
      const alarm = await chrome.alarms.get(AUTO_UPDATE_ALARM);
      return {
        ok: true,
        settings,
        autoAddSettings,
        status,
        nextRunAt: alarm?.scheduledTime ?? null,
      };
    }

    if (message?.type === "auto:save") {
      const time = typeof message.time === "string" ? message.time : "09:00";
      const { hour, minute } = parseTime(time);
      const normalizedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      await chrome.storage.local.set({
        autoUpdateEnabled: Boolean(message.enabled),
        autoUpdateTime: normalizedTime,
        parallelTabs: Math.min(100, Math.max(1, Number(message.parallelTabs) || 1)),
      });
      const scheduledTime = await configureAlarm();
      return { ok: true, nextRunAt: scheduledTime };
    }

    if (message?.type === "auto:run-now") {
      return { ok: startRun("manual") };
    }

    if (message?.type === "auto-add:start") {
      const sourceUrl = normalizeSearchUrl(message.sourceUrl);
      const limit = Math.min(1_000, Math.max(1, Number(message.limit) || 1));
      await chrome.storage.local.set({ autoAddSourceUrl: sourceUrl, autoAddLimit: limit });
      return { ok: startTask(() => runAutoAdd(sourceUrl, limit)) };
    }

    if (message?.type === "task:cancel") {
      if (!currentRun) return { ok: false, error: "実行中の処理はありません。" };
      cancelRequested = true;
      await setStatus({ message: "現在の商品処理が終わり次第、停止します。" });
      return { ok: true };
    }

    return { ok: false, error: "不明な操作です。" };
  })()
    .then(sendResponse)
    .catch((error) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true;
});
