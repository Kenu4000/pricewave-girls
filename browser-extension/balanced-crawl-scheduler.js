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

  function balancedCycleUnits(products) {
    const source = Array.isArray(products) ? products : [];
    let cycleUnits = 0;
    for (const product of source) {
      const interval = normalizeInterval(product?.crawlIntervalDays);
      if (!BALANCED_INTERVALS.has(interval)) continue;
      cycleUnits += BALANCE_CYCLE_DAYS / interval;
    }
    return cycleUnits;
  }

  function balancedScheduleWindow(products, value = Date.now()) {
    const cycleUnits = balancedCycleUnits(products);
    if (cycleUnits <= 0) return { slotStart: 0, target: 0 };

    const cycleDay = positiveModulo(localDayNumber(value), BALANCE_CYCLE_DAYS);
    const before = Math.floor((cycleDay * cycleUnits) / BALANCE_CYCLE_DAYS);
    const after = Math.floor(((cycleDay + 1) * cycleUnits) / BALANCE_CYCLE_DAYS);
    return {
      slotStart: before,
      target: Math.max(0, after - before),
    };
  }

  function balancedDailyTarget(products, value = Date.now()) {
    return balancedScheduleWindow(products, value).target;
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

  function compareCandidatePriority(left, right, nowMs) {
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
    return 0;
  }

  function rotateCandidates(candidates, slotStart) {
    if (candidates.length <= 1) return candidates.slice();
    const offset = positiveModulo(slotStart, candidates.length);
    if (offset === 0) return candidates.slice();
    return [...candidates.slice(offset), ...candidates.slice(0, offset)];
  }

  function selectBalancedProducts(products, value = Date.now()) {
    const source = Array.isArray(products) ? products : [];
    const nowMs = value instanceof Date ? value.getTime() : Number(value);
    const normalizedNow = Number.isFinite(nowMs) ? nowMs : Date.now();
    const daily = [];
    const balancedCandidates = [];

    // 全登録商品を毎回周期で分類する。
    // lastCheckedAt は対象外にする条件には使わず、長周期商品の優先順位にだけ使う。
    for (const product of source) {
      const interval = normalizeInterval(product?.crawlIntervalDays);
      if (interval === null) continue;

      if (interval === 1) {
        daily.push(product);
        continue;
      }

      if (BALANCED_INTERVALS.has(interval)) {
        balancedCandidates.push(product);
      }
    }

    balancedCandidates.sort((left, right) => (Number(left?.id) || 0) - (Number(right?.id) || 0));
    const window = balancedScheduleWindow(source, value);
    const rotatedCandidates = rotateCandidates(balancedCandidates, window.slotStart);
    // sortは安定ソートなので、同じ優先度なら日ごとにずらした候補順を維持する。
    rotatedCandidates.sort((left, right) => compareCandidatePriority(left, right, normalizedNow));
    const balanced = rotatedCandidates.slice(0, window.target);

    return {
      products: [...daily, ...balanced],
      dailyCount: daily.length,
      balancedCount: balanced.length,
      balancedTarget: window.target,
      deferredCount: Math.max(0, balancedCandidates.length - balanced.length),
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
