(() => {
  const originalProcessProductsInParallel = processProductsInParallel;
  const TEST_CONTINUE_KEY = "continueThroughAccessChallenges";

  async function readTestContinueMode() {
    const stored = await chrome.storage.local.get({ [TEST_CONTINUE_KEY]: false });
    return Boolean(stored[TEST_CONTINUE_KEY]);
  }

  function skippedAccessChallengeError() {
    const error = new Error(
      "テストモードのため、アクセス確認の商品を失敗としてスキップして次へ進みます。",
    );
    error.name = "SkippedAccessChallengeError";
    return error;
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

    // テストON時は、内側の「2商品連続で停止」判定へ通常のアクセス確認を渡さない。
    // 403/429 等 nonSkippable の AccessChallengeError だけはそのまま停止させる。
    const processorIgnoringAccessChallenges = async (product) => {
      try {
        return await processor(product);
      } catch (error) {
        if (!(error instanceof AccessChallengeError) || error.nonSkippable) {
          throw error;
        }

        // 実行中に設定をOFFへ切り替えた場合は、次の検出から通常モードへ戻す。
        if (!(await readTestContinueMode())) {
          throw error;
        }
        throw skippedAccessChallengeError();
      }
    };

    await setStatus({
      message: "テストモードON: 通常のアクセス確認は停止せずスキップします。",
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
