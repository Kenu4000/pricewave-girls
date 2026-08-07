const importButton = document.querySelector("#import-button");
const status = document.querySelector("#status");
const productLink = document.querySelector("#product-link");
const autoEnabled = document.querySelector("#auto-enabled");
const autoTime = document.querySelector("#auto-time");
const fastSiteMode = document.querySelector("#fast-site-mode");
const parallelTabsInput = document.querySelector("#parallel-tabs");
const continueAccessChallengeMode = document.querySelector("#continue-access-challenge-mode");
const dailyBrandAddButton = document.querySelector("#daily-brand-add-button");
const dailyBrandAddPanel = document.querySelector("#daily-brand-add-panel");
const dailyBrandAddInput = document.querySelector("#daily-brand-add-input");
const dailyBrandAddConfirm = document.querySelector("#daily-brand-add-confirm");
const dailyBrandList = document.querySelector("#daily-brand-list");
const dailyBrandSummary = document.querySelector("#daily-brand-summary");
const saveAutoButton = document.querySelector("#save-auto-button");
const runAllButton = document.querySelector("#run-all-button");
const resumeTaskButton = document.querySelector("#resume-task-button");
const autoStatus = document.querySelector("#auto-status");
const stopTaskButton = document.querySelector("#stop-task-button");
const autoAddUrl = document.querySelector("#auto-add-url");
const autoAddLimit = document.querySelector("#auto-add-limit");
const autoAddButton = document.querySelector("#auto-add-button");

let dailyBrandOptions = [];
let dailyBrandDefaultsLoaded = false;
let currentDailyBrandOverrideEnabled = false;

function normalizedInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isInteger(number)
    ? Math.min(maximum, Math.max(minimum, number))
    : fallback;
}

function normalizeCrawlBrand(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\s\u3000・･._\-‐‑–—:：'’`´"“”!?！？☆★+＋/／\\&＆×†()[\]（）［］{}｛｝]/gu, "");
}

function dailyBrandCheckedValues() {
  return [...dailyBrandList.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => input.dataset.value || "")
    .filter(Boolean);
}

function updateDailyBrandSummary() {
  const checked = dailyBrandCheckedValues().length;
  dailyBrandSummary.textContent = dailyBrandOptions.length > 0
    ? `日次巡回: ${checked}ブランド / 一覧 ${dailyBrandOptions.length}ブランド`
    : "日次巡回ブランドを取得できませんでした。";
}

function renderDailyBrandOptions(selectedValues = []) {
  const selectedKeys = new Set(selectedValues.map(normalizeCrawlBrand));
  dailyBrandList.replaceChildren();

  if (dailyBrandOptions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "daily-brand-empty";
    empty.textContent = "ブランド一覧がありません。＋から追加できます。";
    dailyBrandList.append(empty);
    updateDailyBrandSummary();
    return;
  }

  for (const option of dailyBrandOptions) {
    const label = document.createElement("label");
    label.className = "daily-brand-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.value = option.value;
    checkbox.checked = selectedKeys.has(normalizeCrawlBrand(option.value));
    checkbox.addEventListener("change", updateDailyBrandSummary);

    const text = document.createElement("span");
    text.textContent = option.label;

    label.append(checkbox, text);
    dailyBrandList.append(label);
  }

  updateDailyBrandSummary();
}

function mergeStoredDailyBrands(defaultOptions, storedBrands) {
  const merged = [...defaultOptions];
  const existingKeys = new Set(merged.map((option) => normalizeCrawlBrand(option.value)));

  for (const rawBrand of Array.isArray(storedBrands) ? storedBrands : []) {
    const brand = String(rawBrand || "").trim();
    if (!brand) continue;
    const key = normalizeCrawlBrand(brand);
    if (!key || existingKeys.has(key)) continue;
    existingKeys.add(key);
    merged.push({ value: brand, label: brand, isDefault: false });
  }

  return merged;
}

async function loadDailyBrandOptions(modeSettings) {
  currentDailyBrandOverrideEnabled = Boolean(modeSettings.dailyCrawlBrandOverrideEnabled);
  const storedBrands = Array.isArray(modeSettings.dailyCrawlBrands)
    ? modeSettings.dailyCrawlBrands
    : [];

  try {
    const response = await fetch("http://localhost:3000/api/crawl-brands");
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.brands)) {
      throw new Error(result.error || "日次巡回ブランドを取得できませんでした。");
    }

    const defaults = result.brands
      .filter((brand) => brand && typeof brand.value === "string" && typeof brand.label === "string")
      .map((brand) => ({
        value: brand.value,
        label: brand.label,
        isDefault: true,
      }));
    dailyBrandDefaultsLoaded = true;
    dailyBrandOptions = mergeStoredDailyBrands(defaults, storedBrands);
    renderDailyBrandOptions(
      currentDailyBrandOverrideEnabled
        ? storedBrands
        : defaults.map((option) => option.value),
    );
  } catch {
    dailyBrandDefaultsLoaded = false;
    dailyBrandOptions = mergeStoredDailyBrands([], storedBrands);
    renderDailyBrandOptions(storedBrands);
  }
}

function sameBrandSelection(leftValues, rightValues) {
  const left = new Set(leftValues.map(normalizeCrawlBrand).filter(Boolean));
  const right = new Set(rightValues.map(normalizeCrawlBrand).filter(Boolean));
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function addDailyBrand() {
  const brand = dailyBrandAddInput.value.trim();
  if (!brand) return;

  const selected = dailyBrandCheckedValues();
  const key = normalizeCrawlBrand(brand);
  const existing = dailyBrandOptions.find(
    (option) => normalizeCrawlBrand(option.value) === key,
  );

  if (existing) {
    if (!selected.some((value) => normalizeCrawlBrand(value) === key)) {
      selected.push(existing.value);
    }
  } else {
    dailyBrandOptions.push({ value: brand, label: brand, isDefault: false });
    selected.push(brand);
  }

  dailyBrandOptions.sort((left, right) => left.label.localeCompare(right.label, "ja"));
  renderDailyBrandOptions(selected);
  dailyBrandAddInput.value = "";
  dailyBrandAddPanel.hidden = true;
}

function syncFastSiteModeForm() {
  parallelTabsInput.disabled = !fastSiteMode.checked;
}

function showStatus(message, kind) {
  status.textContent = message;
  status.dataset.kind = kind;
}

function isSurugayaProductUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const isSurugaya =
      url.hostname === "suruga-ya.jp" || url.hostname.endsWith(".suruga-ya.jp");
    return isSurugaya && /^\/product\/detail\/[0-9A-Za-z]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

async function importCurrentPage() {
  importButton.disabled = true;
  productLink.hidden = true;
  showStatus("商品ページと他ショップ一覧を読み取っています…", "");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !isSurugayaProductUrl(tab.url)) {
      throw new Error("駿河屋の商品詳細ページを開いてから実行してください。");
    }

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const markerId = "pricewave-other-shops-data";
        const hasOtherShops = /他のショップ/.test(document.body?.innerText || "");
        const deadline = Date.now() + 20_000;
        let marker = document.getElementById(markerId);

        while (marker?.dataset.state === "loading" && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          marker = document.getElementById(markerId);
        }

        return {
          url: window.location.href,
          html: document.documentElement.outerHTML,
          title: document.title,
          hasOtherShops,
          otherShopsState: marker?.dataset.state || "missing",
          otherShopsError: marker?.dataset.error || "",
        };
      },
    });
    const page = injection?.result;

    if (!page?.html || /^(Just a moment|Attention Required)/i.test(page.title)) {
      throw new Error("アクセス確認ではなく、商品ページが表示されてから実行してください。");
    }

    if (page.hasOtherShops && page.otherShopsState !== "ready") {
      if (page.otherShopsState === "missing") {
        throw new Error(
          "他ショップ取得機能を読み込めませんでした。拡張機能を再読み込みした後、商品ページも再読み込みしてください。",
        );
      }
      throw new Error(
        page.otherShopsError || "他ショップ一覧を取得できませんでした。商品ページを再読み込みしてください。",
      );
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

    showStatus(
      page.hasOtherShops
        ? "販売・買取価格、在庫状態、他ショップ価格を記録しました。"
        : "販売価格・買取価格・在庫状態を記録しました。",
      "success",
    );
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

function syncResumeButton(checkpoint, response) {
  const remaining = Array.isArray(checkpoint?.remainingProducts)
    ? checkpoint.remainingProducts.length
    : 0;
  const running = response?.status?.state === "running";
  resumeTaskButton.disabled = running || remaining === 0;
  resumeTaskButton.textContent = remaining > 0
    ? `停止位置から再開（残り${remaining}件）`
    : "停止位置から再開";
}

async function loadAutoSettings(syncForm = true) {
  const response = await chrome.runtime.sendMessage({ type: "auto:get" });
  const modeSettings = await chrome.storage.local.get({
    fastSiteModeEnabled: false,
    parallelTabs: 10,
    continueThroughAccessChallenges: false,
    dailyCrawlBrandOverrideEnabled: false,
    dailyCrawlBrands: [],
    crawlResumeCheckpoint: null,
  });

  if (syncForm && response?.settings) {
    autoEnabled.checked = response.settings.autoUpdateEnabled;
    autoTime.value = response.settings.autoUpdateTime;
    fastSiteMode.checked = Boolean(modeSettings.fastSiteModeEnabled);
    parallelTabsInput.value = String(
      normalizedInteger(modeSettings.parallelTabs, 1, 100, 10),
    );
    continueAccessChallengeMode.checked = Boolean(
      modeSettings.continueThroughAccessChallenges,
    );
    syncFastSiteModeForm();
    await loadDailyBrandOptions(modeSettings);
  }
  if (syncForm && response?.autoAddSettings) {
    autoAddUrl.value = response.autoAddSettings.sourceUrl;
    autoAddLimit.value = String(
      normalizedInteger(response.autoAddSettings.limit, 1, 1_000, 1_000),
    );
  }
  syncResumeButton(modeSettings.crawlResumeCheckpoint, response);
  renderAutoStatus(response);
}

async function saveAutoSettings() {
  saveAutoButton.disabled = true;
  try {
    const parallelTabs = normalizedInteger(parallelTabsInput.value, 1, 100, 10);
    const dailyCrawlBrands = dailyBrandCheckedValues();
    const defaultBrands = dailyBrandOptions
      .filter((option) => option.isDefault)
      .map((option) => option.value);
    const dailyCrawlBrandOverrideEnabled = dailyBrandDefaultsLoaded
      ? !sameBrandSelection(dailyCrawlBrands, defaultBrands)
      : currentDailyBrandOverrideEnabled || dailyCrawlBrands.length > 0;

    await chrome.storage.local.set({
      fastSiteModeEnabled: fastSiteMode.checked,
      parallelTabs,
      continueThroughAccessChallenges: continueAccessChallengeMode.checked,
      dailyCrawlBrandOverrideEnabled,
      dailyCrawlBrands,
    });
    currentDailyBrandOverrideEnabled = dailyCrawlBrandOverrideEnabled;

    const response = await chrome.runtime.sendMessage({
      type: "auto:save",
      enabled: autoEnabled.checked,
      time: autoTime.value,
      parallelTabs,
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
    await chrome.storage.local.set({ crawlResumeRequested: false });
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

async function resumeFromCheckpoint() {
  resumeTaskButton.disabled = true;
  try {
    const stored = await chrome.storage.local.get("crawlResumeCheckpoint");
    const remaining = stored.crawlResumeCheckpoint?.remainingProducts;
    if (!Array.isArray(remaining) || remaining.length === 0) {
      throw new Error("再開できる停止位置はありません。");
    }

    await chrome.storage.local.set({ crawlResumeRequested: true });
    const response = await chrome.runtime.sendMessage({ type: "auto:run-now" });
    if (!response?.ok) {
      await chrome.storage.local.set({ crawlResumeRequested: false });
      throw new Error("別の更新処理が実行中です。");
    }
    await loadAutoSettings(false);
  } catch (error) {
    autoStatus.textContent = error instanceof Error ? error.message : "停止位置から再開できませんでした。";
    autoStatus.dataset.kind = "error";
  } finally {
    await loadAutoSettings(false).catch(() => {});
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

fastSiteMode.addEventListener("change", syncFastSiteModeForm);
dailyBrandAddButton.addEventListener("click", () => {
  dailyBrandAddPanel.hidden = !dailyBrandAddPanel.hidden;
  if (!dailyBrandAddPanel.hidden) dailyBrandAddInput.focus();
});
dailyBrandAddConfirm.addEventListener("click", addDailyBrand);
dailyBrandAddInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDailyBrand();
  }
});
saveAutoButton.addEventListener("click", saveAutoSettings);
runAllButton.addEventListener("click", runAllProducts);
resumeTaskButton.addEventListener("click", resumeFromCheckpoint);
autoAddButton.addEventListener("click", startAutoAdd);
stopTaskButton.addEventListener("click", stopTask);
void loadAutoSettings();

const statusTimer = setInterval(() => {
  void loadAutoSettings(false);
}, 1_000);

window.addEventListener("unload", () => clearInterval(statusTimer));
