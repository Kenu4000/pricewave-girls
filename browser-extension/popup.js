const importButton = document.querySelector("#import-button");
const status = document.querySelector("#status");
const productLink = document.querySelector("#product-link");
const autoEnabled = document.querySelector("#auto-enabled");
const autoTime = document.querySelector("#auto-time");
const parallelTabs = document.querySelector("#parallel-tabs");
const saveAutoButton = document.querySelector("#save-auto-button");
const runAllButton = document.querySelector("#run-all-button");
const autoStatus = document.querySelector("#auto-status");
const stopTaskButton = document.querySelector("#stop-task-button");
const autoAddUrl = document.querySelector("#auto-add-url");
const autoAddLimit = document.querySelector("#auto-add-limit");
const autoAddButton = document.querySelector("#auto-add-button");

function showStatus(message, kind) {
  status.textContent = message;
  status.dataset.kind = kind;
}

function isSurugayaProductUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const isSurugaya =
      url.hostname === "suruga-ya.jp" || url.hostname.endsWith(".suruga-ya.jp");
    return isSurugaya && /^\/product\/detail\/[0-9]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

async function importCurrentPage() {
  importButton.disabled = true;
  productLink.hidden = true;
  showStatus("商品ページを読み取っています…", "");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !isSurugayaProductUrl(tab.url)) {
      throw new Error("駿河屋の商品詳細ページを開いてから実行してください。");
    }

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        url: window.location.href,
        html: document.documentElement.outerHTML,
        title: document.title,
      }),
    });
    const page = injection?.result;

    if (!page?.html || /^(Just a moment|Attention Required)/i.test(page.title)) {
      throw new Error("アクセス確認ではなく、商品ページが表示されてから実行してください。");
    }

    const response = await fetch("http://localhost:3000/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: page.url, html: page.html }),
    });
    const result = await response.json();

    if (!response.ok || !result.id) {
      throw new Error(result.error || "駿河屋価格トラッキングへの記録に失敗しました。");
    }

    showStatus("販売価格・買取価格・在庫状態を記録しました。", "success");
    productLink.href = `http://localhost:3000/products/${result.id}`;
    productLink.hidden = false;
  } catch (error) {
    const message =
      error instanceof TypeError
        ? "駿河屋価格トラッキングに接続できません。先に npm.cmd run dev を実行してください。"
        : error instanceof Error
          ? error.message
          : "取込に失敗しました。";
    showStatus(message, "error");
  } finally {
    importButton.disabled = false;
  }
}

importButton.addEventListener("click", importCurrentPage);

function formatDateTime(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString("ja-JP") : "未定";
}

function renderAutoStatus(response) {
  if (!response?.ok) {
    autoStatus.textContent = response?.error || "自動更新の状態を取得できません。";
    autoStatus.dataset.kind = "error";
    return;
  }

  const current = response.status?.current || 0;
  const total = response.status?.total || 0;
  const progress = response.status?.state === "running" ? ` (${current}/${total})` : "";
  const next = response.settings?.autoUpdateEnabled
    ? ` 次回: ${formatDateTime(response.nextRunAt)}`
    : "";
  autoStatus.textContent = `${response.status?.message || "待機中"}${progress}${next}`;
  autoStatus.dataset.kind = ["error", "blocked"].includes(response.status?.state)
    ? "error"
    : response.status?.state === "completed"
      ? "success"
      : "";
}

async function loadAutoSettings(syncForm = true) {
  const response = await chrome.runtime.sendMessage({ type: "auto:get" });
  if (syncForm && response?.settings) {
    autoEnabled.checked = response.settings.autoUpdateEnabled;
    autoTime.value = response.settings.autoUpdateTime;
    parallelTabs.value = String(response.settings.parallelTabs);
  }
  if (syncForm && response?.autoAddSettings) {
    autoAddUrl.value = response.autoAddSettings.sourceUrl;
    autoAddLimit.value = String(response.autoAddSettings.limit);
  }
  renderAutoStatus(response);
}

async function saveAutoSettings() {
  saveAutoButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "auto:save",
      enabled: autoEnabled.checked,
      time: autoTime.value,
      parallelTabs: Number(parallelTabs.value),
    });
    if (!response?.ok) {
      throw new Error(response?.error || "設定を保存できませんでした。");
    }
    await loadAutoSettings();
  } catch (error) {
    autoStatus.textContent = error instanceof Error ? error.message : "設定を保存できませんでした。";
    autoStatus.dataset.kind = "error";
  } finally {
    saveAutoButton.disabled = false;
  }
}

async function runAllProducts() {
  runAllButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "auto:run-now" });
    if (!response?.ok) {
      throw new Error("自動更新は既に実行中です。");
    }
    await loadAutoSettings();
  } catch (error) {
    autoStatus.textContent = error instanceof Error ? error.message : "自動更新を開始できませんでした。";
    autoStatus.dataset.kind = "error";
  } finally {
    runAllButton.disabled = false;
  }
}

async function startAutoAdd() {
  autoAddButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "auto-add:start",
      sourceUrl: autoAddUrl.value.trim(),
      limit: Number(autoAddLimit.value),
    });
    if (!response?.ok) {
      throw new Error(response?.error || "別の更新処理が実行中です。");
    }
    await loadAutoSettings();
  } catch (error) {
    autoStatus.textContent = error instanceof Error ? error.message : "自動追加を開始できませんでした。";
    autoStatus.dataset.kind = "error";
  } finally {
    autoAddButton.disabled = false;
  }
}

async function stopTask() {
  stopTaskButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "task:cancel" });
    if (!response?.ok) {
      throw new Error(response?.error || "処理を停止できませんでした。");
    }
    await loadAutoSettings(false);
  } catch (error) {
    autoStatus.textContent = error instanceof Error ? error.message : "処理を停止できませんでした。";
    autoStatus.dataset.kind = "error";
  } finally {
    stopTaskButton.disabled = false;
  }
}

saveAutoButton.addEventListener("click", saveAutoSettings);
runAllButton.addEventListener("click", runAllProducts);
autoAddButton.addEventListener("click", startAutoAdd);
stopTaskButton.addEventListener("click", stopTask);
void loadAutoSettings();

const statusTimer = setInterval(() => {
  void loadAutoSettings(false);
}, 1_000);

window.addEventListener("unload", () => clearInterval(statusTimer));
