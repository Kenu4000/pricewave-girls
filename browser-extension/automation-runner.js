(() => {
  const statusElement = document.querySelector("#pricewave-automation-status");
  if (!statusElement || document.documentElement.dataset.pricewaveAutomationStarted === "1") return;
  document.documentElement.dataset.pricewaveAutomationStarted = "1";

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const setStatus = (message, kind = "") => {
    statusElement.textContent = message;
    statusElement.dataset.kind = kind;
  };

  async function extensionMessage(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response) throw new Error("拡張機能から応答がありません。");
    return response;
  }

  async function publishViewer(crawlRunId) {
    setStatus("巡回完了。Viewerを生成してGitHub Pagesへ公開しています…");
    const response = await fetch("http://localhost:3000/api/automation/publish-viewer", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ crawlRunId }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Viewer公開に失敗しました。");
    }
    setStatus("巡回とViewer公開が完了しました。", "success");
  }

  async function main() {
    const before = await extensionMessage({ type: "auto:get" });
    if (!before.ok) throw new Error(before.error || "巡回状態を取得できませんでした。");
    const previousLastRunAt = Number(before.status?.lastRunAt) || 0;

    await chrome.storage.local.set({ crawlResumeRequested: false });
    setStatus("巡回を開始しています…");
    const startedAt = Date.now();
    const started = await extensionMessage({ type: "auto:run-now" });
    if (!started.ok) {
      const current = await extensionMessage({ type: "auto:get" });
      if (current.status?.state !== "running") {
        throw new Error(started.error || "巡回を開始できませんでした。");
      }
    }

    let observedRunning = false;
    for (;;) {
      await wait(1_000);
      const response = await extensionMessage({ type: "auto:get" });
      if (!response.ok) throw new Error(response.error || "巡回状態を取得できませんでした。");

      const state = response.status?.state || "idle";
      const current = Number(response.status?.current) || 0;
      const total = Number(response.status?.total) || 0;
      const message = response.status?.message || "巡回状態を確認中です。";
      if (state === "running") {
        observedRunning = true;
        setStatus(total > 0 ? `${message} (${current}/${total})` : message);
        continue;
      }

      const lastRunAt = Number(response.status?.lastRunAt) || 0;
      const updatedAt = Number(response.status?.updatedAt) || 0;
      const belongsToThisRun =
        observedRunning || lastRunAt > previousLastRunAt || updatedAt >= startedAt;
      if (!belongsToThisRun) continue;

      if (state === "completed") {
        await publishViewer(response.status?.crawlRunId ?? null);
        return;
      }
      if (["error", "blocked", "cancelled"].includes(state)) {
        throw new Error(message);
      }

      setStatus(message);
    }
  }

  void main().catch((error) => {
    setStatus(
      error instanceof Error ? error.message : "自動更新に失敗しました。",
      "error",
    );
  });
})();
