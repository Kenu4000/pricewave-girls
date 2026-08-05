(function exposePricewaveFastTestModePolicy(globalObject) {
  const MIN_PARALLEL_TABS = 2;
  const MAX_PARALLEL_TABS = 10;
  const DEFAULT_PARALLEL_TABS = 10;

  function normalizeParallelTabs(value) {
    const number = Number(value);
    return Number.isInteger(number)
      ? Math.min(MAX_PARALLEL_TABS, Math.max(MIN_PARALLEL_TABS, number))
      : DEFAULT_PARALLEL_TABS;
  }

  function isActive(enabled, manualRunRequested) {
    return Boolean(enabled && manualRunRequested);
  }

  function effectiveParallelTabs(enabled, manualRunRequested, requestedTabs) {
    return isActive(enabled, manualRunRequested)
      ? normalizeParallelTabs(requestedTabs)
      : 1;
  }

  const policy = {
    MIN_PARALLEL_TABS,
    MAX_PARALLEL_TABS,
    DEFAULT_PARALLEL_TABS,
    normalizeParallelTabs,
    isActive,
    effectiveParallelTabs,
  };

  globalObject.PricewaveFastTestModePolicy = policy;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = policy;
  }
})(typeof globalThis === "undefined" ? self : globalThis);
