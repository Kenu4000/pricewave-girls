(function exposePricewaveFastSiteModePolicy(globalObject) {
  const MIN_PARALLEL_TABS = 1;
  const MAX_PARALLEL_TABS = 100;
  const DEFAULT_PARALLEL_TABS = 10;

  function normalizeParallelTabs(value) {
    const number = Number(value);
    return Number.isInteger(number)
      ? Math.min(MAX_PARALLEL_TABS, Math.max(MIN_PARALLEL_TABS, number))
      : DEFAULT_PARALLEL_TABS;
  }

  function effectiveParallelTabs(enabled, requestedTabs) {
    return enabled ? normalizeParallelTabs(requestedTabs) : 1;
  }

  const policy = {
    MIN_PARALLEL_TABS,
    MAX_PARALLEL_TABS,
    DEFAULT_PARALLEL_TABS,
    normalizeParallelTabs,
    effectiveParallelTabs,
  };

  globalObject.PricewaveFastSiteModePolicy = policy;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = policy;
  }
})(typeof globalThis === "undefined" ? self : globalThis);
