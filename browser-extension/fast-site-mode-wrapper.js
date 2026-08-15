importScripts("fast-site-mode-policy.js", "new-product-discovery-policy.js");

(() => {
  const modePolicy = globalThis.PricewaveFastSiteModePolicy;
  const discoveryPolicy = globalThis.PricewaveNewProductDiscoveryPolicy;
  const nativeStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const nativeTabsCreate = chrome.tabs.create.bind(chrome.tabs);
  const DEFAULT_MODE_SETTINGS = {
    fastSiteModeEnabled: false,
    parallelTabs: modePolicy.DEFAULT_PARALLEL_TABS,
  };
  const TAB_EDIT_RETRY_DELAYS_MS = [150, 300, 600, 1_000, 1_500, 2_000, 3_000];
  const TRANSIENT_TAB_EDIT_ERROR = /Tabs cannot be edited right now|user may be dragging a tab/i;

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

  function requestsAutoAddSource(keys) {
    if (typeof keys === "string") return keys === "autoAddSourceUrl";
    if (Array.isArray(keys)) return keys.includes("autoAddSourceUrl");
    if (keys && typeof keys === "object") {
      return Object.prototype.hasOwnProperty.call(keys, "autoAddSourceUrl");
    }
    return false;
  }

  function isTransientTabEditError(error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return TRANSIENT_TAB_EDIT_ERROR.test(message);
  }

  function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
  importScripts("access-challenge-test-mode-wrapper.js");

  chrome.storage.local.get = async (...args) => {
    await initialSettingsReady;
    const stored = await nativeStorageGet(...args);
    if (
      requestsAutoAddSource(args[0]) &&
      discoveryPolicy.shouldReplaceLegacyAutoAddUrl(stored?.autoAddSourceUrl)
    ) {
      stored.autoAddSourceUrl = discoveryPolicy.DEFAULT_RELEASE_DISCOVERY_URL;
    }
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
    const createTab =
      fastSiteModeEnabled && isSurugayaUrl(createProperties?.url)
        ? nativeTabsCreate
        : safeTabsCreate;

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await createTab(createProperties);
      } catch (error) {
        const delayMs = TAB_EDIT_RETRY_DELAYS_MS[attempt];
        if (delayMs === undefined || !isTransientTabEditError(error)) throw error;
        await wait(delayMs);
      }
    }
  };
})();
