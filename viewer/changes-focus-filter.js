(() => {
  const originalRenderChanges = globalThis.renderChanges;
  if (typeof originalRenderChanges !== 'function') return;

  const FEATURED_LIMIT = 20;
  const FEATURED_EXCLUDED = new Set(['BEEP', 'AiNO'].map(normalizeBrand));
  const FEATURED_PINNED_ALIASES = [
    ['暁'],
    ['あっぷりけ'],
    ['Purple software', 'パープルソフトウェア', 'Purple software（パープルソフトウェア）'],
    ['Navel', 'NAVEL', 'navel'],
    ['ぱれっと', 'パレット', 'Palette', 'PALETTE'],
  ];
  const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
  let scope = 'focused';

  function normalizeBrand(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('ja')
      .replace(/[\s\p{P}\p{S}]/gu, '');
  }

  function compareRatioDescending(leftNumerator, leftDenominator, rightNumerator, rightDenominator) {
    return rightNumerator * leftDenominator - leftNumerator * rightDenominator;
  }

  function featuredBrandValues(products) {
    const profiles = new Map();
    const availableValues = new Set();

    for (const product of products || []) {
      const rawBrand = String(product.manufacturer || '').trim();
      const value = normalizeBrand(rawBrand);
      if (!value) continue;
      availableValues.add(value);
      if (FEATURED_EXCLUDED.has(value)) continue;

      const profile = profiles.get(value) || {
        value,
        total: 0,
        daily: 0,
        withinThreeDays: 0,
        withinSevenDays: 0,
        active: 0,
      };
      profile.total += 1;
      if (product.crawlIntervalDays === 1) {
        profile.daily += 1;
        profile.withinThreeDays += 1;
        profile.withinSevenDays += 1;
        profile.active += 1;
      } else if (product.crawlIntervalDays === 3) {
        profile.withinThreeDays += 1;
        profile.withinSevenDays += 1;
        profile.active += 1;
      } else if (product.crawlIntervalDays === 7) {
        profile.withinSevenDays += 1;
        profile.active += 1;
      } else if (product.crawlIntervalDays === 14) {
        profile.active += 1;
      }
      profiles.set(value, profile);
    }

    const automatic = [...profiles.values()]
      .filter((profile) => profile.total >= 2)
      .sort((left, right) =>
        compareRatioDescending(left.withinThreeDays, left.total, right.withinThreeDays, right.total) ||
        compareRatioDescending(left.daily, left.total, right.daily, right.total) ||
        compareRatioDescending(left.withinSevenDays, left.total, right.withinSevenDays, right.total) ||
        compareRatioDescending(left.active, left.total, right.active, right.total) ||
        right.total - left.total ||
        collator.compare(left.value, right.value),
      )
      .slice(0, FEATURED_LIMIT)
      .map((profile) => profile.value);

    const selected = new Set(automatic);
    for (const aliases of FEATURED_PINNED_ALIASES) {
      const value = aliases.map(normalizeBrand).find((candidate) => availableValues.has(candidate));
      if (value && !FEATURED_EXCLUDED.has(value)) selected.add(value);
    }
    return selected;
  }

  function isThreeDaysOrMore(product) {
    const days = Number(product?.crawlIntervalDays);
    return Number.isFinite(days) && days >= 3;
  }

  function focusedChangeIds(data) {
    const products = Array.isArray(data?.products) ? data.products : [];
    const featured = featuredBrandValues(products);
    const focusedProductIds = new Set();

    for (const product of products) {
      if (featured.has(normalizeBrand(product.manufacturer)) && isThreeDaysOrMore(product)) {
        focusedProductIds.add(Number(product.id));
      }
    }
    return focusedProductIds;
  }

  function injectScopeButtons() {
    const heading = document.querySelector('.viewer-change-heading');
    if (!heading || heading.querySelector('.viewer-change-scope')) return;

    const controls = document.createElement('div');
    controls.className = 'viewer-change-scope';
    controls.setAttribute('aria-label', '価格変更の表示対象');
    controls.innerHTML = `
      <button type="button" data-change-scope="focused" class="${scope === 'focused' ? 'active' : ''}">注目メーカー＋3日以上</button>
      <button type="button" data-change-scope="all" class="${scope === 'all' ? 'active' : ''}">全商品</button>
    `;
    heading.append(controls);

    controls.querySelectorAll('[data-change-scope]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.changeScope;
        if (next !== 'focused' && next !== 'all') return;
        if (scope === next) return;
        scope = next;
        globalThis.renderChanges();
      });
    });
  }

  globalThis.renderChanges = function renderChangesWithFocusScope() {
    const data = state?.data;
    if (!data || !Array.isArray(data.priceChanges) || scope === 'all') {
      originalRenderChanges();
      injectScopeButtons();
      return;
    }

    const originalChanges = data.priceChanges;
    const focusedIds = focusedChangeIds(data);
    data.priceChanges = originalChanges.filter((change) => focusedIds.has(Number(change.productId)));
    try {
      originalRenderChanges();
    } finally {
      data.priceChanges = originalChanges;
    }
    injectScopeButtons();
  };
})();
