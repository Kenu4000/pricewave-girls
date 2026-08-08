importScripts("popular-refresh-wrapper.js");

(() => {
  const originalProcessProductsInParallel = processProductsInParallel;
  const originalRunAllProducts = runAllProducts;
  const originalRequestLocal = requestLocal;
  const originalExecuteScript = chrome.scripting.executeScript.bind(chrome.scripting);
  const RESUME_CHECKPOINT_KEY = "crawlResumeCheckpoint";
  const RESUME_REQUEST_KEY = "crawlResumeRequested";
  const TEST_CONTINUE_KEY = "continueThroughAccessChallenges";
  const ACCESS_CHALLENGE_RESUME_DELAY_MINUTES = 1;
  const HARD_BLOCK_STATUS_CODES = new Set([403, 429]);
  const recentMainFrameResponses = new Map();

  let activeResumeProducts = null;

  function isRegisteredProductList(products) {
    return Array.isArray(products) && products.some((product) => typeof product?.title === "string");
  }

  function compactProduct(product) {
    return {
      id: product?.id ?? null,
      title: typeof product?.title === "string" ? product.title : String(product?.id ?? "商品"),
      url: typeof product?.url === "string" ? product.url : "",
    };
  }

  function normalizedUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      url.hash = "";
      return url.toString();
    } catch {
      return typeof rawUrl === "string" ? rawUrl : "";
    }
  }

  function rememberMainFrameResponse(details) {
    if (!Number.isInteger(details?.tabId) || details.tabId < 0) return;
    recentMainFrameResponses.set(details.tabId, {
      url: normalizedUrl(details.url),
      statusCode: Number(details.statusCode),
      seenAt: Date.now(),
    });
  }

  if (chrome.webRequest?.onHeadersReceived?.addListener) {
    chrome.webRequest.onHeadersReceived.addListener(
      rememberMainFrameResponse,
      {
        urls: ["https://suruga-ya.jp/*", "https://*.suruga-ya.jp/*"],
        types: ["main_frame"],
      },
    );
  }

  function hardBlockResponseForInjection(injection, results) {
    const tabId = injection?.target?.tabId;
    if (!Number.isInteger(tabId)) return null;

    const response = recentMainFrameResponses.get(tabId);
    if (!response || !HARD_BLOCK_STATUS_CODES.has(response.statusCode)) return null;

    const pageUrl = normalizedUrl(
      (results ?? []).find((result) => typeof result?.result?.url === "string")?.result?.url,
    );
    if (pageUrl && response.url && pageUrl !== response.url) return null;

    // 古いタブ状態を誤利用しない。商品ページ読込直後の応答だけを採用する。
    if (Date.now() - response.seenAt > 2 * 60 * 1000) return null;
    return response;
  }

  chrome.scripting.executeScript = async (injection) => {
    const results = await originalExecuteScript(injection);
    const hardBlockResponse = hardBlockResponseForInjection(injection, results);
    if (!hardBlockResponse) return results;

    const error = new AccessChallengeError(
      `駿河屋がHTTP ${hardBlockResponse.statusCode}を返したため、自動更新を停止しました。`,
    );
    error.nonSkippable = true;
    error.httpStatus = hardBlockResponse.statusCode;
    throw error;
  };

  async function readTestContinueMode() {
    const stored = await chrome.storage.local.get({ [TEST_CONTINUE_KEY]: false });
    return Boolean(stored[TEST_CONTINUE_KEY]);
  }

  async function readResumeCheckpoint() {
    const stored = await chrome.storage.local.get(RESUME_CHECKPOINT_KEY);
    const checkpoint = stored[RESUME_CHECKPOINT_KEY];
    if (!checkpoint || !Array.isArray(checkpoint.remainingProducts)) return null;
    return checkpoint;
  }

  async function clearResumeCheckpoint() {
    await chrome.storage.local.remove([RESUME_CHECKPOINT_KEY, RESUME_REQUEST_KEY]);
  }

  async function saveResumeCheckpoint(products, completedIndices, reason, autoResume) {
    if (!isRegisteredProductList(products)) return null;

    let firstIncompleteIndex = 0;
    while (firstIncompleteIndex < products.length && completedIndices.has(firstIncompleteIndex)) {
      firstIncompleteIndex += 1;
    }
    if (firstIncompleteIndex >= products.length) {
      await clearResumeCheckpoint();
      return null;
    }

    const remainingProducts = products
      .slice(firstIncompleteIndex)
      .map(compactProduct)
      .filter((product) => product.url);
    if (remainingProducts.length === 0) return null;

    const checkpoint = {
      remainingProducts,
      firstIncompleteIndex,
      originalTotal: products.length,
      reason,
      autoResume: Boolean(autoResume),
      savedAt: Date.now(),
    };
    await chrome.storage.local.set({ [RESUME_CHECKPOINT_KEY]: checkpoint });
    return checkpoint;
  }

  processProductsInParallel = async function processProductsWithAccessChallengeRetry(
    products,
    requestedParallelTabs,
    describeProduct,
    processor = updateOneProduct,
    intervalMs = UPDATE_INTERVAL_MS,
  ) {
    const registeredProductRun = isRegisteredProductList(products);
    const continueThroughChallenges = registeredProductRun && (await readTestContinueMode());
    const completedIndices = new Set();
    const productIndices = new Map(products.map((product, index) => [product, index]));
    let consecutiveAccessChallenges = 0;

    const processorWithChallengePolicy = async (product) => {
      const index = productIndices.get(product) ?? products.indexOf(product);
      try {
        const result = await processor(product);
        if (index >= 0) completedIndices.add(index);
        consecutiveAccessChallenges = 0;
        return result;
      } catch (error) {
        if (error instanceof AccessChallengeError) {
          if (error.nonSkippable) {
            consecutiveAccessChallenges = 0;
            throw error;
          }

          consecutiveAccessChallenges += 1;
          if (continueThroughChallenges || consecutiveAccessChallenges === 1) {
            if (index >= 0) completedIndices.add(index);
            const skippedError = new Error(
              continueThroughChallenges
                ? "テストモードのため、アクセス確認の商品をスキップして次へ進みます。"
                : "駿河屋のアクセス確認を1回検出したため、この商品をスキップして次の商品を確認します。",
            );
            skippedError.name = "SkippedAccessChallengeError";
            throw skippedError;
          }

          error.message =
            "駿河屋のアクセス確認が2商品連続で表示されたため、この位置で一時停止しました。";
          throw error;
        }

        if (index >= 0) completedIndices.add(index);
        consecutiveAccessChallenges = 0;
        throw error;
      }
    };

    try {
      return await originalProcessProductsInParallel(
        products,
        requestedParallelTabs,
        describeProduct,
        processorWithChallengePolicy,
        intervalMs,
      );
    } catch (error) {
      if (registeredProductRun && error instanceof AccessChallengeError) {
        await saveResumeCheckpoint(
          products,
          completedIndices,
          error.nonSkippable ? "policy-block" : "access-challenge",
          !error.nonSkippable,
        );
      } else if (registeredProductRun && error instanceof TaskCancelledError) {
        await saveResumeCheckpoint(products, completedIndices, "cancelled", false);
      }
      throw error;
    }
  };

  requestLocal = async function requestLocalWithResume(path, options = {}) {
    if (path === "/api/products" && Array.isArray(activeResumeProducts)) {
      return {
        result: { products: activeResumeProducts },
        origin: "resume-checkpoint",
      };
    }
    return originalRequestLocal(path, options);
  };

  runAllProducts = async function runAllProductsWithResume(trigger) {
    const resumeRequest = await chrome.storage.local.get({ [RESUME_REQUEST_KEY]: false });
    const manualResumeRequested = Boolean(resumeRequest[RESUME_REQUEST_KEY]);
    const retryResumeRequested = trigger === "retry" || trigger === "resume";
    const shouldResume = manualResumeRequested || retryResumeRequested;
    const checkpoint = shouldResume ? await readResumeCheckpoint() : null;

    if (checkpoint?.remainingProducts?.length) {
      activeResumeProducts = checkpoint.remainingProducts;
      await chrome.storage.local.set({ [RESUME_REQUEST_KEY]: false });
      await setStatus({
        message: `停止位置から残り${activeResumeProducts.length}件を再開します。`,
      });
    } else {
      activeResumeProducts = null;
      if (!shouldResume) {
        await clearResumeCheckpoint();
        await chrome.alarms.clear(AUTO_UPDATE_RETRY_ALARM);
      } else {
        await chrome.storage.local.set({ [RESUME_REQUEST_KEY]: false });
      }
    }

    try {
      return await originalRunAllProducts(trigger);
    } finally {
      activeResumeProducts = null;
      const status = await getStatus();
      const latestCheckpoint = await readResumeCheckpoint();

      if (status.state === "completed") {
        await clearResumeCheckpoint();
        await chrome.alarms.clear(AUTO_UPDATE_RETRY_ALARM);
      } else if (status.state === "blocked" && latestCheckpoint) {
        const remaining = latestCheckpoint.remainingProducts.length;
        if (latestCheckpoint.autoResume) {
          await chrome.alarms.create(AUTO_UPDATE_RETRY_ALARM, {
            delayInMinutes: ACCESS_CHALLENGE_RESUME_DELAY_MINUTES,
          });
          await setStatus({
            message: `${status.message} 残り${remaining}件を保存し、1分後に停止位置から再開します。`,
          });
        } else {
          await chrome.alarms.clear(AUTO_UPDATE_RETRY_ALARM);
          await setStatus({
            message: `${status.message} 残り${remaining}件の停止位置を保存しました。手動で再開できます。`,
          });
        }
      } else if (status.state === "cancelled" && latestCheckpoint) {
        await chrome.alarms.clear(AUTO_UPDATE_RETRY_ALARM);
        await setStatus({
          message: `${status.message} 残り${latestCheckpoint.remainingProducts.length}件の停止位置を保存しました。`,
        });
      }
    }
  };

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== AUTO_UPDATE_RETRY_ALARM) return;
    void readResumeCheckpoint().then((checkpoint) => {
      if (!checkpoint?.remainingProducts?.length) return;
      startRun("resume");
    });
  });
})();
