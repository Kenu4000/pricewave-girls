(() => {
  const FEATURED_LIMIT = 20;
  const FEATURED_EXCLUDED = new Set(['BEEP', 'AiNO'].map(normalize));
  const FEATURED_PINNED_ALIASES = [
    ['暁'],
    ['あっぷりけ'],
    ['Purple software', 'パープルソフトウェア', 'Purple software（パープルソフトウェア）'],
    ['Navel', 'NAVEL', 'navel'],
    ['ぱれっと', 'パレット', 'Palette', 'PALETTE'],
  ];
  const app = document.querySelector('#app');
  if (!app) return;

  const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
  let applying = false;

  function normalize(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('ja')
      .replace(/[\s\p{P}\p{S}]/gu, '');
  }

  function compareRatioDescending(leftNumerator, leftDenominator, rightNumerator, rightDenominator) {
    return rightNumerator * leftDenominator - leftNumerator * rightDenominator;
  }

  function pinnedValues(availableValues) {
    const values = [];
    for (const aliases of FEATURED_PINNED_ALIASES) {
      const value = aliases.map(normalize).find((candidate) => availableValues.has(candidate));
      if (value && !FEATURED_EXCLUDED.has(value) && !values.includes(value)) values.push(value);
    }
    return values;
  }

  function rankedFeaturedValues(products, availableValues) {
    const profiles = new Map();
    for (const product of products || []) {
      const label = String(product.manufacturer || '').trim();
      const value = normalize(label);
      if (!value || FEATURED_EXCLUDED.has(value) || !availableValues.has(value)) continue;
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
    const automaticSet = new Set(automatic);
    const pinned = pinnedValues(availableValues).filter((value) => !automaticSet.has(value));

    return [...automatic, ...pinned];
  }

  const productsPromise = fetch('./data/index.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => Array.isArray(data?.products) ? data.products : [])
    .catch(() => []);

  async function applyBrandOptions() {
    if (applying) return;
    const select = document.querySelector('#brand');
    if (!(select instanceof HTMLSelectElement)) return;

    const selectedValue = select.value;
    const blankLabel = [...select.options].find((option) => option.value === '')?.textContent?.trim() || 'すべて';
    const optionMap = new Map();
    for (const option of select.querySelectorAll('option')) {
      if (!option.value) continue;
      const label = option.textContent?.trim() || option.value;
      if (!optionMap.has(option.value)) optionMap.set(option.value, { value: option.value, label });
    }
    if (!optionMap.size) return;

    const products = await productsPromise;
    const featured = rankedFeaturedValues(products, new Set(optionMap.keys()))
      .flatMap((value) => optionMap.has(value) ? [optionMap.get(value)] : [])
      .sort((left, right) => collator.compare(left.label, right.label));
    const alphabetical = [...optionMap.values()]
      .sort((left, right) => collator.compare(left.label, right.label));
    const signature = `${featured.map((option) => option.value).join('\u0000')}|${alphabetical.map((option) => option.value).join('\u0000')}`;
    if (select.dataset.featuredBrandOrder === signature) return;

    applying = true;
    try {
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = blankLabel;
      const nodes = [blank];

      if (featured.length) {
        const group = document.createElement('optgroup');
        group.label = 'よく登録されているメーカー';
        for (const source of featured) {
          const option = document.createElement('option');
          option.value = source.value;
          option.textContent = source.label;
          group.append(option);
        }
        nodes.push(group);
      }

      if (alphabetical.length) {
        const group = document.createElement('optgroup');
        group.label = '五十音順';
        for (const source of alphabetical) {
          const option = document.createElement('option');
          option.value = source.value;
          option.textContent = source.label;
          group.append(option);
        }
        nodes.push(group);
      }

      select.replaceChildren(...nodes);
      select.value = selectedValue;
      select.dataset.featuredBrandOrder = signature;
    } finally {
      applying = false;
    }
  }

  let queued = false;
  function scheduleApply() {
    if (queued || applying) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      void applyBrandOptions();
    });
  }

  new MutationObserver(scheduleApply).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleApply);
  scheduleApply();
})();
