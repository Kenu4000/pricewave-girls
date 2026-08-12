importScripts("fast-site-mode-policy.js", "new-product-discovery-policy.js");

(() => {
  const MOBILE_OTHER_SHOP_PORT = "pricewave-mobile-other-shops";
  const MOBILE_OTHER_SHOP_USER_AGENT =
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36";

  function mobileUserAgentRuleId(tabId) {
    return 900_000_000 + (tabId % 100_000_000);
  }

  async function setMobileOtherShopUserAgent(tabId, enabled) {
    const ruleId = mobileUserAgentRuleId(tabId);
    if (!enabled) {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
      return;
    }

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [
        {
          id: ruleId,
          priority: 100,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              {
                header: "user-agent",
                operation: "set",
                value: MOBILE_OTHER_SHOP_USER_AGENT,
              },
            ],
          },
          condition: {
            tabIds: [tabId],
            urlFilter: "pricewave_snapshot=mobile",
            resourceTypes: ["sub_frame"],
          },
        },
      ],
    });
  }

  // 実Extensionではruntime.onConnectが常に使える。既存の単体テスト用Chromeモックは
  // runtime自体を持たないため、読み込み時は能力検出して従来テストを壊さない。
  if (chrome.runtime?.onConnect?.addListener) {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== MOBILE_OTHER_SHOP_PORT) return;
      const tabId = port.sender?.tab?.id;
      if (!Number.isInteger(tabId) || tabId < 0) {
        port.disconnect();
        return;
      }

      let enabled = false;
      port.onMessage.addListener((message) => {
        const requestId = message?.requestId;
        void setMobileOtherShopUserAgent(tabId, Boolean(message?.enabled))
          .then(() => {
            enabled = Boolean(message?.enabled);
            port.postMessage({ requestId, ok: true });
          })
          .catch((error) => {
            port.postMessage({
              requestId,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      });

      port.onDisconnect.addListener(() => {
        if (enabled) void setMobileOtherShopUserAgent(tabId, false).catch(() => {});
      });
    });
  }

  const modePolicy = globalThis.PricewaveFastSiteModePolicy;
  const discoveryPolicy = globalThis.PricewaveNewProductDiscoveryPolicy;
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

  function requestsAutoAddSource(keys) {
    if (typeof keys === "string") return keys === "autoAddSourceUrl";
    if (Array.isArray(keys)) return keys.includes("autoAddSourceUrl");
    if (keys && typeof keys === "object") {
      return Object.prototype.hasOwnProperty.call(keys, "autoAddSourceUrl");
    }
    return false;
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
    if (fastSiteModeEnabled && isSurugayaUrl(createProperties?.url)) {
      return nativeTabsCreate(createProperties);
    }
    return safeTabsCreate(createProperties);
  };
})();
