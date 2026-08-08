(() => {
  const originalProcessProductsInParallel = processProductsInParallel;
  const TEST_CONTINUE_KEY = "continueThroughAccessChallenges";

  async function readTestContinueMode() {
    const stored = await chrome.storage.local.get({ [TEST_CONTINUE_KEY]: false });
    return Boolean(stored[TEST_CONTINUE_KEY]);
  }

  function skippedAccessChallengeError(error) {
    const status = Number.isInteger(error?.httpStatus) ? `HTTP ${error.httpStatus}` : "アクセス確認";
    const skipped = new Error(
      `テストモードのため、${status}の商品を失敗としてスキップして次へ進みます。`,
    );
    skipped.name = "SkippedAccessChallengeError";
    return skipped;
  }

  processProductsInParallel = async function processProductsWithHardTestMode(
    products,
    requestedParallelTabs,
    describeProduct,
    processor = updateOneProduct,
    intervalMs = UPDATE_INTERVAL_MS,
  ) {
    const testModeAtStart = await readTestContinueMode();
    if (!testModeAtStart) {
      return originalProcessProductsInParallel(
        products,
        requestedParallelTabs,
        describeProduct,
        processor,
        intervalMs,
      );
    }

    // テストON時はアクセス確認・実HTTP 403/429とも、その商品を失敗扱いで飛ばす。
    // 制限ページの再試行や突破は行わず、巡回処理が最後まで進むかだけを検証する。
    const processorIgnoringAccessChallenges = async (product) => {
      try {
        return await processor(product);
      } catch (error) {
        if (!(error instanceof AccessChallengeError)) {
          throw error;
        }

        // 実行中に設定をOFFへ切り替えた場合は、次の検出から通常モードへ戻す。
        if (!(await readTestContinueMode())) {
          throw error;
        }
        throw skippedAccessChallengeError(error);
      }
    };

    await setStatus({
      message: "テストモードON: アクセス確認・HTTP 403/429は停止せず失敗扱いでスキップします。",
    });

    return originalProcessProductsInParallel(
      products,
      requestedParallelTabs,
      describeProduct,
      processorIgnoringAccessChallenges,
      intervalMs,
    );
  };
})();
