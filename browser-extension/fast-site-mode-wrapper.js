importScripts("fast-site-mode-policy.js");

(() => {
  const modePolicy = globalThis.PricewaveFastSiteModePolicy;
  const nativeStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const nativeTabsCreate = chrome.tabs.create.bind(chrome.tabs);
  const DEFAULT_MODE_SETTINGS = {
    fastSiteModeEnabled: false,
    parallelTabs: modePolicy.DEFAULT_PARALLEL_TABS,
  };

  let fastSiteModeEnabled = false;
  let configuredParallelTabs = modePolicy.DEFAULT_PARALLEL_TABS;

  function applyModeSettings(stored) {
    fastSiteModeEnabled = Boolean(stored?.fastSiteModeEnabled);
    configuredParallelTabs = modePolicy.normalizeParallelTabs(stored?.parallelTabs);
  }

  function isSurugayaUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return url.hostname === "suruga-ya.jp" || url.hostname.endsWith(".suruga-ya.jp");
    } catch {
      return false;
    }
  }

  const initialSettingsReady = nativeStorageGet(DEFAULT_MODE_SETTINGS)
    .then(applyModeSettings)
    .catch(() => {});

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.fastSiteModeEnabled) {
      fastSiteModeEnabled = Boolean(changes.fastSiteModeEnabled.newValue);
    }
    if (changes.parallelTabs) {
      configuredParallelTabs = modePolicy.normalizeParallelTabs(
        changes.parallelTabs.newValue,
      );
    }
  });

  importScripts("access-challenge-retry-wrapper.js");

  chrome.storage.local.get = async (...args) => {
    await initialSettingsReady;
    const stored = await nativeStorageGet(...args);
    if (stored && Object.prototype.hasOwnProperty.call(stored, "parallelTabs")) {
      stored.parallelTabs = modePolicy.effectiveParallelTabs(
        fastSiteModeEnabled,
        configuredParallelTabs,
      );
    }
    return stored;
  };

  const safeTabsCreate = chrome.tabs.create.bind(chrome.tabs);
  chrome.tabs.create = async (createProperties) => {
    await initialSettingsReady;
    if (fastSiteModeEnabled && isSurugayaUrl(createProperties?.url)) {
      return nativeTabsCreate(createProperties);
    }
    return safeTabsCreate(createProperties);
  };
})();
