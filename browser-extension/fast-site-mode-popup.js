(() => {
  const fastSiteMode = document.querySelector("#fast-site-mode");
  const parallelTabs = document.querySelector("#parallel-tabs");
  const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);

  function normalizeParallelTabs(value) {
    const number = Number(value);
    return Number.isInteger(number) ? Math.min(100, Math.max(1, number)) : 10;
  }

  function syncDisabledState() {
    parallelTabs.disabled = !fastSiteMode.checked;
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get({
      fastSiteModeEnabled: false,
      parallelTabs: 10,
    });
    fastSiteMode.checked = Boolean(stored.fastSiteModeEnabled);
    parallelTabs.value = String(normalizeParallelTabs(stored.parallelTabs));
    syncDisabledState();
  }

  fastSiteMode.addEventListener("change", syncDisabledState);

  chrome.runtime.sendMessage = (message, ...rest) => {
    if (message?.type === "auto:save") {
      const normalizedTabs = normalizeParallelTabs(parallelTabs.value);
      void chrome.storage.local.set({
        fastSiteModeEnabled: fastSiteMode.checked,
        parallelTabs: normalizedTabs,
      });
      message = {
        ...message,
        parallelTabs: normalizedTabs,
      };
    }
    return originalSendMessage(message, ...rest);
  };

  void loadSettings();
})();
