importScripts("popular-refresh-wrapper.js");

(() => {
  const originalProcessProductsInParallel = processProductsInParallel;

  processProductsInParallel = async function processProductsWithAccessChallengeRetry(
    products,
    requestedParallelTabs,
    describeProduct,
    processor = updateOneProduct,
    intervalMs = UPDATE_INTERVAL_MS,
  ) {
    let consecutiveAccessChallenges = 0;

    const processorWithOneChallengeRetry = async (product) => {
      try {
        const result = await processor(product);
        consecutiveAccessChallenges = 0;
        return result;
      } catch (error) {
        if (error instanceof AccessChallengeError) {
          consecutiveAccessChallenges += 1;

          if (consecutiveAccessChallenges === 1) {
            const skippedError = new Error(
              "駿河屋のアクセス確認を1回検出したため、この商品をスキップして次の商品を確認します。",
            );
            skippedError.name = "SkippedAccessChallengeError";
            throw skippedError;
          }

          error.message =
            "駿河屋のアクセス確認が2商品連続で表示されたため、自動更新を停止しました。";
          throw error;
        }

        consecutiveAccessChallenges = 0;
        throw error;
      }
    };

    return originalProcessProductsInParallel(
      products,
      requestedParallelTabs,
      describeProduct,
      processorWithOneChallengeRetry,
      intervalMs,
    );
  };
})();
