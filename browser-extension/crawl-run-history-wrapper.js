(() => {
  const originalRunAllProducts = runAllProducts;
  const TERMINAL_STATES = new Set(["completed", "blocked", "cancelled", "error"]);

  async function createCrawlRun(trigger) {
    try {
      const { result } = await requestLocal("/api/crawl-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger }),
      });
      return Number.isInteger(result?.id) ? result.id : null;
    } catch (error) {
      console.warn("Pricewave: 巡回実行履歴の開始記録に失敗しました。", error);
      return null;
    }
  }

  async function finishCrawlRun(runId) {
    if (!Number.isInteger(runId)) return;

    try {
      const status = await getStatus();
      const state = TERMINAL_STATES.has(status.state) ? status.state : "error";
      await requestLocal(`/api/crawl-runs/${runId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: state,
          total: Math.max(0, Number(status.total) || 0),
          succeeded: Math.max(0, Number(status.succeeded) || 0),
          failed: Math.max(0, Number(status.failed) || 0),
          message: typeof status.message === "string" ? status.message : null,
        }),
      });
    } catch (error) {
      console.warn("Pricewave: 巡回実行履歴の完了記録に失敗しました。", error);
    }
  }

  runAllProducts = async function runAllProductsWithHistory(trigger) {
    await setStatus({ crawlRunId: null });
    const crawlRunId = await createCrawlRun(trigger);
    if (crawlRunId !== null) await setStatus({ crawlRunId });

    try {
      return await originalRunAllProducts(trigger);
    } finally {
      await finishCrawlRun(crawlRunId);
    }
  };
})();
