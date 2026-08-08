(() => {
  const runtimeState = document.querySelector("#runtime-state");
  if (!runtimeState) return;

  async function render() {
    const version = chrome.runtime.getManifest().version;
    const stored = await chrome.storage.local.get({ continueThroughAccessChallenges: false });
    runtimeState.textContent = stored.continueThroughAccessChallenges
      ? `拡張 v${version} / テストモード ON（アクセス確認はスキップ）`
      : `拡張 v${version} / テストモード OFF`;
    runtimeState.dataset.kind = stored.continueThroughAccessChallenges ? "success" : "";
  }

  void render();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.continueThroughAccessChallenges) {
      void render();
    }
  });
})();
