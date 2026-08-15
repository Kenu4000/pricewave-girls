(function exposeBalancedCrawlScheduler(globalObject) {
  const DAY_MS = 24 * 60 * 60 * 1_000;
  const BALANCE_CYCLE_DAYS = 42;
  const VALID_INTERVALS = new Set([1, 3, 7, 14]);
  const BALANCED_INTERVALS = new Set([3, 7, 14]);

  function normalizeInterval(value) {
    if (value === null) return null;
    const interval = Number(value);
    return VALID_INTERVALS.has(interval) ? interval : null;
  }

  function localDayNumber(value = Date.now()) {
    const date = value instanceof Date ? value : new Date(value);
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  }

  function positiveModulo(value, divisor) {
    const remainder = value % divisor;
    return remainder < 0 ? remainder + divisor : remainder;
  }

  function checkedAtMs(product) {
    if (!product?.lastCheckedAt) return null;
    const timestamp = Date.parse(product.lastCheckedAt);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function isDue(product, interval, nowMs) {
    const checkedAt = checkedAtMs(product);
    if (checkedAt === null) return true;
    return nowMs - checkedAt >= interval * DAY_MS;
  }

  function balancedDailyTarget(products, value = Date.now()) {
    const source = Array.isArray(products) ? products : [];
    let cycleUnits = 0;

    for (const product of source) {
      const interval = normalizeInterval(product?.crawlIntervalDays);
      if (!BALANCED_INTERVALS.has(interval)) continue;
      cycleUnits += BALANCE_CYCLE_DAYS / interval;
    }

    if (cycleUnits <= 0) return 0;

    const cycleDay = positiveModulo(localDayNumber(value), BALANCE_CYCLE_DAYS);
    const before = Math.floor((cycleDay * cycleUnits) / BALANCE_CYCLE_DAYS);
    const after = Math.floor(((cycleDay + 1) * cycleUnits) / BALANCE_CYCLE_DAYS);
    return Math.max(0, after - before);
  }

  function overduePriority(product, interval, nowMs) {
    const checkedAt = checkedAtMs(product);
    if (checkedAt === null) {
      return {
        ratio: Number.POSITIVE_INFINITY,
        elapsed: Number.POSITIVE_INFINITY,
      };
    }

    const elapsed = Math.max(0, nowMs - checkedAt);
    return {
      ratio: elapsed / (interval * DAY_MS),
      elapsed,
    };
  }

  function compareEligible(left, right, nowMs) {
    const leftInterval = normalizeInterval(left?.crawlIntervalDays) ?? 1;
    const rightInterval = normalizeInterval(right?.crawlIntervalDays) ?? 1;
    const leftPriority = overduePriority(left, leftInterval, nowMs);
    const rightPriority = overduePriority(right, rightInterval, nowMs);

    if (leftPriority.ratio !== rightPriority.ratio) {
      if (!Number.isFinite(leftPriority.ratio)) return -1;
      if (!Number.isFinite(rightPriority.ratio)) return 1;
      return rightPriority.ratio - leftPriority.ratio;
    }
    if (leftPriority.elapsed !== rightPriority.elapsed) {
      if (!Number.isFinite(leftPriority.elapsed)) return -1;
      if (!Number.isFinite(rightPriority.elapsed)) return 1;
      return rightPriority.elapsed - leftPriority.elapsed;
    }
    return (Number(left?.id) || 0) - (Number(right?.id) || 0);
  }

  function selectBalancedProducts(products, value = Date.now()) {
    const source = Array.isArray(products) ? products : [];
    const nowMs = value instanceof Date ? value.getTime() : Number(value);
    const normalizedNow = Number.isFinite(nowMs) ? nowMs : Date.now();
    const daily = [];
    const eligibleBalanced = [];

    for (const product of source) {
      const interval = normalizeInterval(product?.crawlIntervalDays);
      if (interval === null) continue;

      if (interval === 1) {
        if (isDue(product, interval, normalizedNow)) daily.push(product);
        continue;
      }

      if (BALANCED_INTERVALS.has(interval) && isDue(product, interval, normalizedNow)) {
        eligibleBalanced.push(product);
      }
    }

    eligibleBalanced.sort((left, right) => compareEligible(left, right, normalizedNow));

    let balancedTarget = balancedDailyTarget(source, value);
    if (eligibleBalanced.length > 0 && balancedTarget === 0) balancedTarget = 1;
    const balanced = eligibleBalanced.slice(0, balancedTarget);

    return {
      products: [...daily, ...balanced],
      dailyCount: daily.length,
      balancedCount: balanced.length,
      balancedTarget,
      deferredCount: Math.max(0, eligibleBalanced.length - balanced.length),
      totalRegistered: source.length,
    };
  }

  const scheduler = {
    DAY_MS,
    BALANCE_CYCLE_DAYS,
    normalizeInterval,
    balancedDailyTarget,
    selectBalancedProducts,
  };

  globalObject.PricewaveBalancedCrawlScheduler = scheduler;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = scheduler;
  }
})(typeof globalThis === "undefined" ? self : globalThis);
