(() => {
  const nativeExecuteScript = chrome.scripting.executeScript.bind(chrome.scripting);
  const CAPTURE_ELEMENT_ID = "pricewave-other-shops-data";
  const CAPTURE_WAIT_TIMEOUT_MS = 22_000;
  const CAPTURE_POLL_INTERVAL_MS = 100;

  function isProductHtmlReadInjection(injection) {
    if (!Number.isInteger(injection?.target?.tabId) || typeof injection?.func !== "function") {
      return false;
    }
    const source = Function.prototype.toString.call(injection.func);
    return source.includes("document.documentElement?.outerHTML");
  }

  async function waitForOtherShopCapture(tabId) {
    try {
      await nativeExecuteScript({
        target: { tabId },
        func: async (elementId, timeoutMs, pollIntervalMs) => {
          const deadline = Date.now() + timeoutMs;
          const terminalStates = new Set(["ready", "error", "not_applicable"]);

          while (Date.now() < deadline) {
            const marker = document.getElementById(elementId);
            if (marker && terminalStates.has(marker.dataset.state || "")) return;
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          }
        },
        args: [CAPTURE_ELEMENT_ID, CAPTURE_WAIT_TIMEOUT_MS, CAPTURE_POLL_INTERVAL_MS],
      });
    } catch {
      // 他店舗一覧の待機補助だけで、通常の商品価格取込は失敗させない。
    }
  }

  chrome.scripting.executeScript = async (injection) => {
    if (isProductHtmlReadInjection(injection)) {
      await waitForOtherShopCapture(injection.target.tabId);
    }
    return nativeExecuteScript(injection);
  };
})();
