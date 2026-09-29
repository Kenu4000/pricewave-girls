(() => {
  const originalRenderProducts = globalThis.renderProducts;
  if (typeof originalRenderProducts !== 'function' || typeof globalThis.filteredProducts !== 'function') return;

  const PRICE_BANDS = [
    { value: 'under-1000', label: '999円以下', max: 999 },
    { value: '1000-2999', label: '1,000〜2,999円', min: 1000, max: 2999 },
    { value: '3000-4999', label: '3,000〜4,999円', min: 3000, max: 4999 },
    { value: '5000-9999', label: '5,000〜9,999円', min: 5000, max: 9999 },
    { value: '10000-19999', label: '10,000〜19,999円', min: 10000, max: 19999 },
    { value: '20000-plus', label: '20,000円以上', min: 20000 },
    { value: 'unknown', label: '未取得', unknown: true },
  ];
  const OS_ORDER = [
    'Windows 11', 'Windows 10', 'Windows 8.1', 'Windows 8', 'Windows 7',
    'Windows Vista', 'Windows XP', 'Windows 2000', 'Windows Me', 'Windows 98',
    'Windows 95', 'Windows 3.1', 'Windows', 'macOS', 'MS-DOS', 'Linux', 'PC-98',
  ];
  const DETAIL_FILTERS = {
    operatingSystems: ['対応OS', '動作OS', 'OS', '対応機種'],
    illustrators: ['原画', '原画家'],
    scenarios: ['シナリオ', '脚本'],
    voiceActors: ['声優', 'キャスト'],
  };

  state.sort = state.sort === 'updated_desc' ? 'interesting_desc' : (state.sort || 'interesting_desc');
  state.brand = state.brand || '';
  state.os = state.os || '';
  state.illustrator = state.illustrator || '';
  state.scenario = state.scenario || '';
  state.voiceActor = state.voiceActor || '';
  state.releaseYear = state.releaseYear || '';
  state.saleBand = state.saleBand || '';
  state.buyBand = state.buyBand || '';
  state.stock = state.stock || '';
  state.conditionTitle = state.conditionTitle || '';

  let detailSearchEntries = [];
  let detailIndexLoaded = false;
  let cachedDetailQuery = '';
  let cachedDetailProductIds = new Set();

  function normalizeViewerSearch(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ja');
  }

  function normalizeDetailSearch(value) {
    return normalizeViewerSearch(value).replace(/[\s\p{P}\p{S}]/gu, '');
  }

  function normalizedLabelSet(labels) {
    return new Set(labels.map(normalizeDetailSearch));
  }

  function extractOperatingSystems(rawValue) {
    const value = String(rawValue || '').normalize('NFKC');
    const results = new Set();
    const hasWindows = /win(?:dows)?/iu.test(value);
    if (hasWindows) {
      const versions = value.matchAll(/(?:11|10|8\.1|8|7|Vista|XP|2000|Me|98|95|3\.1)/giu);
      let found = false;
      for (const match of versions) {
        const raw = match[0];
        const version = /vista/i.test(raw) ? 'Vista' : /^xp$/i.test(raw) ? 'XP' : /^me$/i.test(raw) ? 'Me' : raw;
        results.add(`Windows ${version}`);
        found = true;
      }
      if (!found) results.add('Windows');
    }
    if (/macos|mac\s*os|os\s*x/iu.test(value)) results.add('macOS');
    if (/ms[-\s]?dos|dos/iu.test(value)) results.add('MS-DOS');
    if (/linux/iu.test(value)) results.add('Linux');
    if (/pc[-\s]?98(?:01|21)?/iu.test(value)) results.add('PC-98');
    return OS_ORDER.filter((os) => results.has(os));
  }

  function detailMatchingProductIds(rawQuery) {
    const query = normalizeDetailSearch(rawQuery.trim());
    if (!query || !detailSearchEntries.length) return new Set();
    if (query === cachedDetailQuery) return cachedDetailProductIds;

    const ids = new Set();
    for (const entry of detailSearchEntries) {
      if (!entry.value.includes(query)) continue;
      for (const id of entry.productIds) ids.add(id);
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

  globalThis.viewerProductMatchesSearch = (product, rawQuery) => matchesViewerSearch(product, rawQuery);

  function addOption(index, rawLabel, productIds) {
    const label = String(rawLabel || '').trim();
    const value = normalizeDetailSearch(label);
    if (!value) return;
    const option = index.get(value) || { value, label, ids: new Set() };
    if (label.length && (option.label === option.value || label.length < option.label.length)) option.label = label;
    for (const id of productIds || []) option.ids.add(Number(id));
    index.set(value, option);
  }

  function detailOptionIndex(field) {
    const index = new Map();
    for (const product of state.data.products || []) {
      const values = product.filterData?.[field];
      if (!Array.isArray(values)) continue;
      for (const value of values) addOption(index, value, [product.id]);
    }

    const labels = normalizedLabelSet(DETAIL_FILTERS[field] || []);
    for (const entry of detailSearchEntries) {
      if (!labels.has(entry.label)) continue;
      if (field === 'operatingSystems') {
        for (const os of extractOperatingSystems(entry.value)) addOption(index, os, entry.productIds);
      } else {
        addOption(index, entry.value, entry.productIds);
      }
    }

    if (field === 'operatingSystems') {
      for (const product of state.data.products || []) {
        for (const os of extractOperatingSystems(`${product.title || ''}\n${product.searchText || ''}`)) {
          addOption(index, os, [product.id]);
        }
      }
    }
    return index;
  }

  function optionMatchesProduct(product, field, selectedValue, optionIndex) {
    if (!selectedValue) return true;
    const selected = normalizeDetailSearch(selectedValue);
    const values = product.filterData?.[field];
    if (Array.isArray(values) && values.length) {
      return values.some((value) => normalizeDetailSearch(value) === selected);
    }
    const option = optionIndex.get(selected);
    if (option?.ids.has(Number(product.id))) return true;
    if (field === 'operatingSystems') {
      return extractOperatingSystems(`${product.title || ''}\n${product.searchText || ''}`)
        .some((value) => normalizeDetailSearch(value) === selected);
    }
    return false;
  }

  function matchesPriceBand(price, value) {
    if (!value) return true;
    const band = PRICE_BANDS.find((candidate) => candidate.value === value);
    if (!band) return true;
    if (band.unknown) return price == null;
    if (price == null) return false;
    if (band.min != null && Number(price) < band.min) return false;
    if (band.max != null && Number(price) > band.max) return false;
    return true;
  }

  function matchesStock(product) {
    if (!state.stock) return true;
    if (state.stock === 'unknown') return product.stockStatus == null || product.stockStatus === 'unknown';
    return product.stockStatus === state.stock;
  }

  function matchesConditionTitle(product) {
    if (state.conditionTitle !== 'exclude') return true;
    return product.conditionRank !== 'B' && !product.condition;
  }

  function compareNullableNumber(left, right, direction) {
    const leftMissing = left == null;
    const rightMissing = right == null;
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    return direction === 'asc' ? Number(left) - Number(right) : Number(right) - Number(left);
  }

  function compareTitle(left, right) {
    return String(left.title || '').localeCompare(String(right.title || ''), 'ja', { numeric: true, sensitivity: 'base' }) || left.id - right.id;
  }

  function productSpread(product) {
    if (product.latestSalePrice == null || product.latestBuyPrice == null) return null;
    return Math.abs(Number(product.latestSalePrice) - Number(product.latestBuyPrice));
  }

  function interestSeriesMetrics(changes, type) {
    const series = changes
      .filter((change) => change.type === type && Number(change.previousPrice) > 0 && Number(change.currentPrice) > 0 && Number(change.previousPrice) !== Number(change.currentPrice))
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
    return {
      score: Math.min(rangeRatio, 2) * 40 + Math.min(changeCount, 12) * 3 + Math.min(reversalCount, 6) * 8 + Math.max(0, 1 - ageDays / 30) * 20,
      latestChangedAt,
    };
  }

  function viewerInterestScores() {
    const changesByProduct = new Map();
    for (const change of state.data.priceChanges || []) {
      const changes = changesByProduct.get(change.productId) || [];
      changes.push(change);
      changesByProduct.set(change.productId, changes);
    }
    const now = Date.now();
    return new Map((state.data.products || []).map((product) => [product.id, viewerInterestScore(changesByProduct.get(product.id) || [], now)]));
  }

  function sortProducts(items) {
    const result = [...items];
    const interestScores = state.sort === 'interesting_desc' ? viewerInterestScores() : null;
    result.sort((left, right) => {
      if (state.sort === 'interesting_desc') {
        const a = interestScores.get(left.id) || { score: 0, latestChangedAt: 0 };
        const b = interestScores.get(right.id) || { score: 0, latestChangedAt: 0 };
        return b.score - a.score || b.latestChangedAt - a.latestChangedAt || compareTitle(left, right);
      }
      if (state.sort === 'updated_asc' || state.sort === 'updated_desc') {
        const a = new Date(left.updatedAt || 0).getTime();
        const b = new Date(right.updatedAt || 0).getTime();
        return (state.sort === 'updated_asc' ? a - b : b - a) || compareTitle(left, right);
      }
      if (state.sort === 'sale_asc' || state.sort === 'sale_desc') {
        return compareNullableNumber(left.latestSalePrice, right.latestSalePrice, state.sort === 'sale_asc' ? 'asc' : 'desc') || compareTitle(left, right);
      }
      if (state.sort === 'buy_asc' || state.sort === 'buy_desc') {
        return compareNullableNumber(left.latestBuyPrice, right.latestBuyPrice, state.sort === 'buy_asc' ? 'asc' : 'desc') || compareTitle(left, right);
      }
      if (state.sort === 'spread_asc' || state.sort === 'spread_desc') {
        return compareNullableNumber(productSpread(left), productSpread(right), state.sort === 'spread_asc' ? 'asc' : 'desc') || compareTitle(left, right);
      }
      if (state.sort === 'release_asc' || state.sort === 'release_desc') {
        const a = String(left.releaseDate || '');
        const b = String(right.releaseDate || '');
        if (!a && !b) return compareTitle(left, right);
        if (!a) return 1;
        if (!b) return -1;
        return (state.sort === 'release_asc' ? a.localeCompare(b) : b.localeCompare(a)) || compareTitle(left, right);
      }
      return compareTitle(left, right);
    });
    return result;
  }

  globalThis.filteredProducts = function filteredProductsMainSearch(source = state.data.products) {
    const detailIds = detailMatchingProductIds(state.query);
    const osIndex = detailOptionIndex('operatingSystems');
    const illustratorIndex = detailOptionIndex('illustrators');
    const scenarioIndex = detailOptionIndex('scenarios');
    const voiceIndex = detailOptionIndex('voiceActors');

    const items = source.filter((product) => {
      if (!matchesViewerSearch(product, state.query, detailIds)) return false;
      if (state.brand && product.manufacturer !== state.brand) return false;
      if (!optionMatchesProduct(product, 'operatingSystems', state.os, osIndex)) return false;
      if (!optionMatchesProduct(product, 'illustrators', state.illustrator, illustratorIndex)) return false;
      if (!optionMatchesProduct(product, 'scenarios', state.scenario, scenarioIndex)) return false;
      if (!optionMatchesProduct(product, 'voiceActors', state.voiceActor, voiceIndex)) return false;
      if (state.releaseYear && !String(product.releaseDate || '').startsWith(`${state.releaseYear}-`)) return false;
      if (!matchesPriceBand(product.latestSalePrice, state.saleBand)) return false;
      if (!matchesPriceBand(product.latestBuyPrice, state.buyBand)) return false;
      if (!matchesStock(product)) return false;
      if (!matchesConditionTitle(product)) return false;
      return true;
    });
    return sortProducts(items);
  };

  function rankedOptions(index, selectedValue, emptyLabel = 'すべて') {
    const options = [...index.values()];
    const featured = options
      .filter((option) => option.ids.size >= 2)
      .sort((a, b) => b.ids.size - a.ids.size || a.label.localeCompare(b.label, 'ja'))
      .slice(0, 12);
    const featuredValues = new Set(featured.map((option) => option.value));
    const alphabetical = options
      .filter((option) => !featuredValues.has(option.value))
      .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
    const selected = normalizeDetailSearch(selectedValue);
    const render = (option) => `<option value="${esc(option.value)}" ${option.value === selected ? 'selected' : ''}>${esc(option.label)}</option>`;
    return `<option value="" ${selected ? '' : 'selected'}>${emptyLabel}</option>${featured.length ? `<optgroup label="よく登録されている">${featured.map(render).join('')}</optgroup>` : ''}${alphabetical.length ? `<optgroup label="五十音順">${alphabetical.map(render).join('')}</optgroup>` : ''}`;
  }

  function brandOptionIndex() {
    const index = new Map();
    for (const product of state.data.products || []) {
      const brand = String(product.manufacturer || '').trim();
      if (!brand) continue;
      const value = normalizeDetailSearch(brand);
      const option = index.get(value) || { value, label: brand, ids: new Set() };
      option.ids.add(Number(product.id));
      index.set(value, option);
    }
    return index;
  }

  function releaseYearOptions() {
    return [...new Set((state.data.products || []).map((product) => String(product.releaseDate || '').match(/^(\d{4})-/)?.[1]).filter(Boolean))]
      .sort((a, b) => Number(b) - Number(a));
  }

  function osOptions(index) {
    const selected = normalizeDetailSearch(state.os);
    return `<option value="">すべて</option>${[...index.values()]
      .sort((a, b) => {
        const left = OS_ORDER.indexOf(a.label);
        const right = OS_ORDER.indexOf(b.label);
        return (left < 0 ? 999 : left) - (right < 0 ? 999 : right) || a.label.localeCompare(b.label, 'ja');
      })
      .map((option) => `<option value="${esc(option.value)}" ${option.value === selected ? 'selected' : ''}>${esc(option.label)}</option>`)
      .join('')}`;
  }

  function priceBandOptions(selectedValue) {
    return `<option value="">すべて</option>${PRICE_BANDS.map((band) => `<option value="${band.value}" ${band.value === selectedValue ? 'selected' : ''}>${band.label}</option>`).join('')}`;
  }

  function advancedFiltersActive() {
    return Boolean(state.brand || state.os || state.illustrator || state.scenario || state.voiceActor || state.releaseYear || state.saleBand || state.buyBand || state.stock || state.conditionTitle);
  }

  function bindStandardPager(results) {
    results.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        state.page = Number(button.dataset.page);
        renderStandardResults();
        scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function renderStandardResults() {
    const results = document.querySelector('#viewer-product-results');
    if (!results) return;
    const items = globalThis.filteredProducts();
    const pages = Math.max(1, Math.ceil(items.length / state.perPage));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.perPage;
    const visible = items.slice(start, start + state.perPage);
    const count = document.querySelector('#viewer-product-count');
    if (count) count.textContent = `${items.length.toLocaleString('ja-JP')}件`;
    results.innerHTML = visible.length
      ? `<div class="grid">${visible.map(productCard).join('')}</div>${pager(items.length)}`
      : '<div class="panel empty">条件に一致する商品がありません。</div>';
    bindStandardPager(results);
  }

  function readSearchForm() {
    state.query = document.querySelector('#q')?.value || '';
    const brandValue = document.querySelector('#brand')?.value || '';
    const brand = [...brandOptionIndex().values()].find((option) => option.value === brandValue)?.label || '';
    state.brand = brand;
    state.sort = document.querySelector('#sort')?.value || 'interesting_desc';
    state.perPage = Number(document.querySelector('#per')?.value || 24);
    state.os = document.querySelector('#filter-os')?.value || '';
    state.illustrator = document.querySelector('#filter-illustrator')?.value || '';
    state.scenario = document.querySelector('#filter-scenario')?.value || '';
    state.voiceActor = document.querySelector('#filter-voice-actor')?.value || '';
    state.releaseYear = document.querySelector('#filter-release-year')?.value || '';
    state.saleBand = document.querySelector('#filter-sale-band')?.value || '';
    state.buyBand = document.querySelector('#filter-buy-band')?.value || '';
    state.stock = document.querySelector('#filter-stock')?.value || '';
    state.conditionTitle = document.querySelector('#filter-condition-title')?.value || '';
  }

  function clearSearchFilters() {
    state.query = '';
    state.brand = '';
    state.sort = 'interesting_desc';
    state.perPage = 24;
    state.os = '';
    state.illustrator = '';
    state.scenario = '';
    state.voiceActor = '';
    state.releaseYear = '';
    state.saleBand = '';
    state.buyBand = '';
    state.stock = '';
    state.conditionTitle = '';
    state.crawlInterval = '';
    state.page = 1;
  }

  function renderProductsStableSearch(customProducts = null, title = '商品一覧') {
    if (customProducts) return originalRenderProducts(customProducts, title);

    const brandIndex = brandOptionIndex();
    const selectedBrandKey = normalizeDetailSearch(state.brand);
    const osIndex = detailOptionIndex('operatingSystems');
    const illustratorIndex = detailOptionIndex('illustrators');
    const scenarioIndex = detailOptionIndex('scenarios');
    const voiceIndex = detailOptionIndex('voiceActors');
    const active = advancedFiltersActive();

    app.innerHTML = `<div class="section-title"><h1>${esc(title)}</h1><span class="muted" id="viewer-product-count"></span></div>
      <form id="viewer-product-search" class="toolbar panel viewer-search-panel filter-panel">
        <div class="primary-search-grid">
          <label class="filter-field primary-name-search"><span>検索</span><input class="search input" id="q" value="${esc(state.query)}" placeholder="商品名・ブランド・原画など" type="search"></label>
          <label class="filter-field"><span>並び順</span><select class="select" id="sort">
            <option value="interesting_desc" ${state.sort === 'interesting_desc' ? 'selected' : ''}>注目度が高い順</option>
            <option value="updated_desc" ${state.sort === 'updated_desc' ? 'selected' : ''}>確認履歴が新しい順</option>
            <option value="updated_asc" ${state.sort === 'updated_asc' ? 'selected' : ''}>確認履歴が古い順</option>
            <option value="sale_asc" ${state.sort === 'sale_asc' ? 'selected' : ''}>販売価格が安い順</option>
            <option value="sale_desc" ${state.sort === 'sale_desc' ? 'selected' : ''}>販売価格が高い順</option>
            <option value="buy_desc" ${state.sort === 'buy_desc' ? 'selected' : ''}>買取価格が高い順</option>
            <option value="buy_asc" ${state.sort === 'buy_asc' ? 'selected' : ''}>買取価格が安い順</option>
            <option value="spread_desc" ${state.sort === 'spread_desc' ? 'selected' : ''}>販売・買取の差が大きい順</option>
            <option value="spread_asc" ${state.sort === 'spread_asc' ? 'selected' : ''}>販売・買取の差が小さい順</option>
            <option value="release_desc" ${state.sort === 'release_desc' ? 'selected' : ''}>発売年度が新しい順</option>
            <option value="release_asc" ${state.sort === 'release_asc' ? 'selected' : ''}>発売年度が古い順</option>
          </select></label>
          <label class="filter-field"><span>表示件数</span><select class="select" id="per"><option value="24" ${state.perPage === 24 ? 'selected' : ''}>24件</option><option value="48" ${state.perPage === 48 ? 'selected' : ''}>48件</option><option value="96" ${state.perPage === 96 ? 'selected' : ''}>96件</option></select></label>
          <button class="viewer-search-submit primary-search-button" type="submit">検索</button>
          <button class="viewer-search-clear primary-clear-button" id="viewer-search-clear" type="button">クリア</button>
        </div>
        <details class="advanced-search" ${active ? 'open' : ''}>
          <summary><span>詳細検索</span>${active ? '<span class="active-filter-label">条件設定中</span>' : ''}</summary>
          <div class="advanced-filter-grid">
            <label class="filter-field"><span>ブランド</span><select class="select" id="brand">${rankedOptions(brandIndex, selectedBrandKey)}</select></label>
            <label class="filter-field"><span>OS</span><select class="select" id="filter-os">${osOptions(osIndex)}</select></label>
            <label class="filter-field"><span>原画</span><select class="select" id="filter-illustrator">${rankedOptions(illustratorIndex, state.illustrator)}</select></label>
            <label class="filter-field"><span>シナリオ</span><select class="select" id="filter-scenario">${rankedOptions(scenarioIndex, state.scenario)}</select></label>
            <label class="filter-field"><span>声優</span><select class="select" id="filter-voice-actor">${rankedOptions(voiceIndex, state.voiceActor)}</select></label>
            <label class="filter-field"><span>発売年度</span><select class="select" id="filter-release-year"><option value="">すべて</option>${releaseYearOptions().map((year) => `<option value="${year}" ${state.releaseYear === year ? 'selected' : ''}>${year}年</option>`).join('')}</select></label>
            <label class="filter-field"><span>販売価格帯</span><select class="select" id="filter-sale-band">${priceBandOptions(state.saleBand)}</select></label>
            <label class="filter-field"><span>買取価格帯</span><select class="select" id="filter-buy-band">${priceBandOptions(state.buyBand)}</select></label>
            <label class="filter-field"><span>在庫状態</span><select class="select" id="filter-stock"><option value="" ${state.stock ? '' : 'selected'}>すべて</option><option value="in_stock" ${state.stock === 'in_stock' ? 'selected' : ''}>在庫あり</option><option value="out_of_stock" ${state.stock === 'out_of_stock' ? 'selected' : ''}>在庫なし</option><option value="unknown" ${state.stock === 'unknown' ? 'selected' : ''}>在庫不明</option></select></label>
            <label class="filter-field"><span>タイトルの状態表記</span><select class="select" id="filter-condition-title"><option value="" ${state.conditionTitle ? '' : 'selected'}>すべて</option><option value="exclude" ${state.conditionTitle === 'exclude' ? 'selected' : ''}>「(状態：...)」付き商品を除外</option></select></label>
          </div>
        </details>
      </form>
      <div id="viewer-product-results"></div>`;

    document.querySelector('#viewer-product-search')?.addEventListener('submit', (event) => {
      event.preventDefault();
      readSearchForm();
      state.page = 1;
      globalThis.renderProducts();
    });
    document.querySelector('#viewer-search-clear')?.addEventListener('click', () => {
      clearSearchFilters();
      const hash = location.hash || '#/products';
      if (hash.startsWith('#/products?')) location.hash = '#/products';
      else globalThis.renderProducts();
    });

    renderStandardResults();
  }

  globalThis.renderProducts = renderProductsStableSearch;

  void fetch('./data/detail-index.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      const filters = data?.filters && typeof data.filters === 'object' ? data.filters : {};
      detailSearchEntries = Object.entries(filters).flatMap(([key, productIds]) => {
        if (!Array.isArray(productIds)) return [];
        const separator = key.indexOf('\u0000');
        if (separator < 0) return [];
        const label = key.slice(0, separator);
        const value = key.slice(separator + 1);
        return value ? [{ label, value, productIds: productIds.map(Number) }] : [];
      });
      detailIndexLoaded = true;
      cachedDetailQuery = '';
      cachedDetailProductIds = new Set();
      const hash = location.hash || '#/products';
      if (hash === '#/products' || hash.startsWith('#/products?')) globalThis.renderProducts();
    })
    .catch(() => {
      detailIndexLoaded = true;
    });
})();