(() => {
  const fastMode = document.querySelector("#fast-test-mode");
  const parallelTabs = document.querySelector("#fast-test-tabs");
  const saveButton = document.querySelector("#save-auto-button");

  function normalizeParallelTabs(value) {
    const number = Number(value);
    return Number.isInteger(number) ? Math.min(10, Math.max(2, number)) : 10;
  }

  function syncDisabledState() {
    parallelTabs.disabled = !fastMode.checked;
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get({
      fastTestModeEnabled: false,
      fastTestParallelTabs: 10,
    });
    fastMode.checked = Boolean(stored.fastTestModeEnabled);
    parallelTabs.value = String(normalizeParallelTabs(stored.fastTestParallelTabs));
    syncDisabledState();
  }

  fastMode.addEventListener("change", syncDisabledState);
  saveButton.addEventListener("click", async () => {
    await chrome.storage.local.set({
      fastTestModeEnabled: fastMode.checked,
      fastTestParallelTabs: normalizeParallelTabs(parallelTabs.value),
    });
  });

  void loadSettings();
})();
