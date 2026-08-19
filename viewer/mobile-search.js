(() => {
  const originalRenderProducts = globalThis.renderProducts;
  const originalFilteredProducts = globalThis.filteredProducts;
  if (typeof originalRenderProducts !== 'function' || typeof originalFilteredProducts !== 'function') return;

  state.sort = 'interesting_desc';

  let detailSearchEntries = [];
  let cachedDetailQuery = '';
  let cachedDetailProductIds = new Set();

  function normalizeViewerSearch(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ja');
  }

  function normalizeDetailSearch(value) {
    return normalizeViewerSearch(value).replace(/[\s\p{P}\p{S}]/gu, '');
  }

  function detailMatchingProductIds(rawQuery) {
    const query = normalizeDetailSearch(rawQuery.trim());
    if (!query || !detailSearchEntries.length) return new Set();
    if (query === cachedDetailQuery) return cachedDetailProductIds;

    const ids = new Set();
    for (const [value, productIds] of detailSearchEntries) {
      if (!value.includes(query)) continue;
      for (const id of productIds) ids.add(Number(id));
    }
    cachedDetailQuery = query;
    cachedDetailProductIds = ids;
    return ids;
  }

  function matchesViewerSearch(product, rawQuery, detailIds = detailMatchingProductIds(rawQuery)) {
    const query = normalizeViewerSearch(rawQuery.trim());
    if (!query) return true;
    const fallback = [product.title, product.manufacturer, product.releaseDate]
      .filter(Boolean)
      .join('\n');
    const haystack = product.searchText || fallback;
    return normalizeViewerSearch(haystack).includes(query) || detailIds.has(Number(product.id));
  }

  globalThis.viewerProductMatchesSearch = (product, rawQuery) =>
    matchesViewerSearch(product, rawQuery);

  void fetch('./data/detail-index.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      const filters = data?.filters && typeof data.filters === 'object' ? data.filters : {};
      detailSearchEntries = Object.entries(filters).flatMap(([key, productIds]) => {
        if (!Array.isArray(productIds)) return [];
        const separator = key.indexOf('\u0000');
        const value = separator >= 0 ? key.slice(separator + 1) : key;
        return value ? [[value, productIds]] : [];
      });
      cachedDetailQuery = '';
      cachedDetailProductIds = new Set();
      if (state.query && location.hash.startsWith('#/products')) renderStandardResults();
    })
    .catch(() => {});

  function bindStandardPager(results) {
    results.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        state.page = Number(button.dataset.page);
        renderStandardResults();
        scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function compareRatioDescending(leftNumerator, leftDenominator, rightNumerator, rightDenominator) {
    return rightNumerator * leftDenominator - leftNumerator * rightDenominator;
  }

  function viewerBrandGroups() {
    const profiles = new Map();
    for (const product of state.data.products) {
      const brand = String(product.manufacturer || '').trim();
      if (!brand) continue;
      const profile = profiles.get(brand) || {
        brand,
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
      profiles.set(brand, profile);
    }

    const alphabetical = [...profiles.keys()]
      .sort((left, right) => left.localeCompare(right, 'ja'));
    const featured = [...profiles.values()]
      .filter((profile) => profile.total >= 2)
      .sort((left, right) =>
        compareRatioDescending(left.withinThreeDays, left.total, right.withinThreeDays, right.total)
        || compareRatioDescending(left.daily, left.total, right.daily, right.total)
        || compareRatioDescending(left.withinSevenDays, left.total, right.withinSevenDays, right.total)
        || compareRatioDescending(left.active, left.total, right.active, right.total)
        || right.total - left.total
        || left.brand.localeCompare(right.brand, 'ja'))
      .map((profile) => profile.brand);

    return { featured, alphabetical };
  }

  function viewerBrandOptions() {
    const { featured, alphabetical } = viewerBrandGroups();
    const featuredSet = new Set(featured);
    const featuredOptions = featured
      .map((brand) => `<option value="${esc(brand)}" ${brand === state.brand ? 'selected' : ''}>${esc(brand)}</option>`)
      .join('');
    const alphabeticalOptions = alphabetical
      .map((brand) => `<option value="${esc(brand)}" ${brand === state.brand && !featuredSet.has(brand) ? 'selected' : ''}>${esc(brand)}</option>`)
      .join('');

    return `<optgroup label="よく登録されているメーカー"><option value="" ${state.brand ? '' : 'selected'}>すべて</option>${featuredOptions}</optgroup><optgroup label="五十音順">${alphabeticalOptions}</optgroup>`;
  }

  function interestSeriesMetrics(changes, type) {
    const series = changes
      .filter((change) =>
        change.type === type
        && Number(change.previousPrice) > 0
        && Number(change.currentPrice) > 0
        && Number(change.previousPrice) !== Number(change.currentPrice))
      .sort((left, right) => new Date(left.changedAt) - new Date(right.changedAt));
    if (!series.length) return { rangeRatio: 0, changeCount: 0, reversalCount: 0, latestChangedAt: 0 };

    const values = [];
    const directions = [];
    let latestChangedAt = 0;
    for (const change of series) {
      const previous = Number(change.previousPrice);
      const current = Number(change.currentPrice);
      values.push(previous, current);
      directions.push(Math.sign(current - previous));
      latestChangedAt = Math.max(latestChangedAt, new Date(change.changedAt).getTime());
    }

    const minPrice = Math.min(...values);
    const maxPrice = Math.max(...values);
    let reversalCount = 0;
    for (let index = 1; index < directions.length; index += 1) {
      if (directions[index] !== directions[index - 1]) reversalCount += 1;
    }
    return {
      rangeRatio: minPrice > 0 ? (maxPrice - minPrice) / minPrice : 0,
      changeCount: directions.length,
      reversalCount,
      latestChangedAt,
    };
  }

  function viewerInterestScore(changes, now = Date.now()) {
    const sale = interestSeriesMetrics(changes, 'sale');
    const buy = interestSeriesMetrics(changes, 'buy');
    const rangeRatio = Math.max(sale.rangeRatio, buy.rangeRatio);
    const changeCount = sale.changeCount + buy.changeCount;
    const reversalCount = sale.reversalCount + buy.reversalCount;
    const latestChangedAt = Math.max(sale.latestChangedAt, buy.latestChangedAt);
    if (!changeCount || !latestChangedAt) return { score: 0, latestChangedAt: 0 };

    const ageDays = Math.max(0, (now - latestChangedAt) / 86400000);
    const score = Math.min(rangeRatio, 2) * 40
      + Math.min(changeCount, 12) * 3
      + Math.min(reversalCount, 6) * 8
      + Math.max(0, 1 - ageDays / 30) * 20;
    return { score, latestChangedAt };
  }

  function viewerInterestScores() {
    const changesByProduct = new Map();
    for (const change of state.data.priceChanges || []) {
      const changes = changesByProduct.get(change.productId) || [];
      changes.push(change);
      changesByProduct.set(change.productId, changes);
    }

    const now = Date.now();
    return new Map(
      state.data.products.map((product) => [
        product.id,
        viewerInterestScore(changesByProduct.get(product.id) || [], now),
      ]),
    );
  }

  globalThis.filteredProducts = function filteredProductsWithInterest(source = state.data.products) {
    const rawQuery = state.query;
    state.query = '';
    let items;
    try {
      items = originalFilteredProducts(source);
    } finally {
      state.query = rawQuery;
    }
    const detailIds = detailMatchingProductIds(rawQuery);
    items = items.filter((product) => matchesViewerSearch(product, rawQuery, detailIds));
    if (state.sort !== 'interesting_desc') return items;

    const scores = viewerInterestScores();
    return [...items].sort((left, right) => {
      const leftInterest = scores.get(left.id) || { score: 0, latestChangedAt: 0 };
      const rightInterest = scores.get(right.id) || { score: 0, latestChangedAt: 0 };
      return rightInterest.score - leftInterest.score
        || rightInterest.latestChangedAt - leftInterest.latestChangedAt
        || left.title.localeCompare(right.title, 'ja')
        || left.id - right.id;
    });
  };

  function renderStandardResults() {
    const results = document.querySelector('#viewer-product-results');
    if (!results) return;

    const items = globalThis.filteredProducts();
    const start = (state.page - 1) * state.perPage;
    const visible = items.slice(start, start + state.perPage);
    const count = document.querySelector('#viewer-product-count');
    if (count) count.textContent = `${items.length.toLocaleString('ja-JP')}件`;

    results.innerHTML = visible.length
      ? `<div class="grid">${visible.map(productCard).join('')}</div>${pager(items.length)}`
      : '<div class="panel empty">条件に一致する商品がありません。</div>';

    bindStandardPager(results);
  }

  function renderProductsStableSearch(customProducts = null, title = '商品一覧') {
    if (customProducts) {
      return originalRenderProducts(customProducts, title);
    }

    app.innerHTML = `<div class="section-title"><h1>${esc(title)}</h1><span class="muted" id="viewer-product-count"></span></div>
      <div class="toolbar panel"><input class="search" id="q" value="${esc(state.query)}" placeholder="商品名・ブランド・原画などで検索"><select id="brand">${viewerBrandOptions()}</select><select id="sort"><option value="updated_desc" ${state.sort === 'updated_desc' ? 'selected' : ''}>更新が新しい順</option><option value="updated_asc" ${state.sort === 'updated_asc' ? 'selected' : ''}>更新が古い順</option><option value="interesting_desc" ${state.sort === 'interesting_desc' ? 'selected' : ''}>注目度が高い順</option><option value="sale_asc" ${state.sort === 'sale_asc' ? 'selected' : ''}>販売価格が安い順</option><option value="sale_desc" ${state.sort === 'sale_desc' ? 'selected' : ''}>販売価格が高い順</option><option value="release_desc" ${state.sort === 'release_desc' ? 'selected' : ''}>発売日が新しい順</option><option value="title_asc" ${state.sort === 'title_asc' ? 'selected' : ''}>商品名順</option></select><select id="per"><option ${state.perPage === 24 ? 'selected' : ''}>24</option><option ${state.perPage === 48 ? 'selected' : ''}>48</option><option ${state.perPage === 96 ? 'selected' : ''}>96</option></select></div>
      <div id="viewer-product-results"></div>`;

    document.querySelector('#q').addEventListener('input', (event) => {
      state.query = event.target.value;
      state.page = 1;
      renderStandardResults();
    });
    document.querySelector('#brand').addEventListener('change', (event) => {
      state.brand = event.target.value;
      state.page = 1;
      renderStandardResults();
    });
    document.querySelector('#sort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      state.page = 1;
      renderStandardResults();
    });
    document.querySelector('#per').addEventListener('change', (event) => {
      state.perPage = Number(event.target.value);
      state.page = 1;
      renderStandardResults();
    });

    renderStandardResults();
  }

  globalThis.renderProducts = renderProductsStableSearch;
})();