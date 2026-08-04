const AUTO_UPDATE_ALARM = "surugaya-daily-update";
const AUTO_UPDATE_RETRY_ALARM = "surugaya-daily-update-retry";
const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const UPDATE_INTERVAL_MS = 15_000;
const PAGE_LOAD_TIMEOUT_MS = 60_000;
const DEFAULT_SETTINGS = {
  autoUpdateEnabled: false,
  autoUpdateTime: "09:00",
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

class AccessChallengeError extends Error {}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

async function updateOneProduct(product) {
  const tab = await chrome.tabs.create({ url: product.url, active: false });
  if (!tab.id) {
    throw new Error("自動更新用のタブを作成できませんでした。");
  }

  try {
    const page = await readProductPage(tab.id);
    await requestLocal("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: page.url, html: page.html }),
    });
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
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

    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];
      await setStatus({
        current: index + 1,
        succeeded,
        failed,
        message: `${index + 1}/${products.length}件目: ${product.title}`,
      });

      try {
        await updateOneProduct(product);
        succeeded += 1;
      } catch (error) {
        failed += 1;
        if (error instanceof AccessChallengeError) {
          if (trigger !== "manual") {
            await chrome.storage.local.set({ lastAutoAttemptDate: localDateKey() });
          }
          await setStatus({
            state: "blocked",
            succeeded,
            failed,
            message: error.message,
          });
          return;
        }
      }

      await setStatus({ succeeded, failed });
      if (index + 1 < products.length) {
        await sleep(UPDATE_INTERVAL_MS);
      }
    }

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

function startRun(trigger) {
  if (currentRun) {
    return false;
  }

  currentRun = runAllProducts(trigger).finally(() => {
    currentRun = null;
  });
  return true;
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
  const stored = await chrome.storage.local.get(["autoUpdateEnabled", "autoUpdateTime"]);
  await chrome.storage.local.set({
    autoUpdateEnabled:
      typeof stored.autoUpdateEnabled === "boolean"
        ? stored.autoUpdateEnabled
        : DEFAULT_SETTINGS.autoUpdateEnabled,
    autoUpdateTime:
      typeof stored.autoUpdateTime === "string"
        ? stored.autoUpdateTime
        : DEFAULT_SETTINGS.autoUpdateTime,
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
      const status = await getStatus();
      const alarm = await chrome.alarms.get(AUTO_UPDATE_ALARM);
      return { ok: true, settings, status, nextRunAt: alarm?.scheduledTime ?? null };
    }

    if (message?.type === "auto:save") {
      const time = typeof message.time === "string" ? message.time : "09:00";
      const { hour, minute } = parseTime(time);
      const normalizedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      await chrome.storage.local.set({
        autoUpdateEnabled: Boolean(message.enabled),
        autoUpdateTime: normalizedTime,
      });
      const scheduledTime = await configureAlarm();
      return { ok: true, nextRunAt: scheduledTime };
    }

    if (message?.type === "auto:run-now") {
      return { ok: startRun("manual") };
    }

    return { ok: false, error: "不明な操作です。" };
  })()
    .then(sendResponse)
    .catch((error) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true;
});
