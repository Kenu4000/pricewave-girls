importScripts("fast-test-mode-policy.js");

(() => {
  const modePolicy = globalThis.PricewaveFastTestModePolicy;
  const nativeStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const nativeTabsCreate = chrome.tabs.create.bind(chrome.tabs);
  const DEFAULT_TEST_SETTINGS = {
    fastTestModeEnabled: false,
    fastTestParallelTabs: modePolicy.DEFAULT_PARALLEL_TABS,
  };

  let fastTestModeEnabled = false;
  let fastTestParallelTabs = modePolicy.DEFAULT_PARALLEL_TABS;
  let pendingManualRun = false;
  let manualRunActive = false;

  function applyTestSettings(stored) {
    fastTestModeEnabled = Boolean(stored?.fastTestModeEnabled);
    fastTestParallelTabs = modePolicy.normalizeParallelTabs(
      stored?.fastTestParallelTabs,
    );
  }

  function isSurugayaUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return url.hostname === "suruga-ya.jp" || url.hostname.endsWith(".suruga-ya.jp");
    } catch {
      return false;
    }
  }

  function resetManualMode() {
    pendingManualRun = false;
    manualRunActive = false;
  }

  void nativeStorageGet(DEFAULT_TEST_SETTINGS)
    .then(applyTestSettings)
    .catch(() => {});

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    if (changes.fastTestModeEnabled || changes.fastTestParallelTabs) {
      if (changes.fastTestModeEnabled) {
        fastTestModeEnabled = Boolean(changes.fastTestModeEnabled.newValue);
      }
      if (changes.fastTestParallelTabs) {
        fastTestParallelTabs = modePolicy.normalizeParallelTabs(
          changes.fastTestParallelTabs.newValue,
        );
      }
    }

    const status = changes.updateStatus?.newValue;
    if (!status) return;

    if (
      pendingManualRun &&
      status.state === "running" &&
      status.message === "登録商品を読み込んでいます。"
    ) {
      manualRunActive = fastTestModeEnabled;
      pendingManualRun = false;
    }

    if (["completed", "blocked", "cancelled", "error", "idle"].includes(status.state)) {
      resetManualMode();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "auto:run-now") {
      pendingManualRun = true;
      return;
    }
    if (["auto-add:start", "task:cancel"].includes(message?.type)) {
      resetManualMode();
    }
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (["surugaya-daily-update", "surugaya-daily-update-retry"].includes(alarm.name)) {
      resetManualMode();
    }
  });

  importScripts("access-challenge-retry-wrapper.js");

  const safeStorageGet = chrome.storage.local.get.bind(chrome.storage.local);
  const safeTabsCreate = chrome.tabs.create.bind(chrome.tabs);

  chrome.storage.local.get = async (...args) => {
    const stored = await safeStorageGet(...args);
    if (!stored || !Object.prototype.hasOwnProperty.call(stored, "parallelTabs")) {
      return stored;
    }

    const latestSettings = await nativeStorageGet(DEFAULT_TEST_SETTINGS).catch(
      () => DEFAULT_TEST_SETTINGS,
    );
    applyTestSettings(latestSettings);

    if (pendingManualRun) {
      manualRunActive = fastTestModeEnabled;
      pendingManualRun = false;
    }

    stored.parallelTabs = modePolicy.effectiveParallelTabs(
      fastTestModeEnabled,
      manualRunActive,
      fastTestParallelTabs,
    );
    return stored;
  };

  chrome.tabs.create = (createProperties) => {
    if (
      modePolicy.isActive(fastTestModeEnabled, manualRunActive) &&
      isSurugayaUrl(createProperties?.url)
    ) {
      return nativeTabsCreate(createProperties);
    }
    return safeTabsCreate(createProperties);
  };
})();
