(() => {
  const originalFilteredProducts = globalThis.filteredProducts;
  const originalRenderProduct = globalThis.renderProduct;
  const originalRenderProducts = globalThis.renderProducts;
  const originalRoute = globalThis.route;
  if (
    typeof originalFilteredProducts !== 'function' ||
    typeof originalRenderProduct !== 'function' ||
    typeof originalRenderProducts !== 'function' ||
    typeof originalRoute !== 'function'
  ) return;

  let detailIndex = null;
  let detailIndexPromise = null;

  function normalizeDetailPart(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/^(?:ブランド|メーカー)\s*[:：]\s*/u, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .toLocaleLowerCase('ja')
      .replace(/[\s\p{P}\p{S}]/gu, '');
  }

  function detailFilterKey(label, value) {
    return `${normalizeDetailPart(label)}\u0000${normalizeDetailPart(value)}`;
  }

  function detailFilterHref(label, value) {
    const params = new URLSearchParams({ detailLabel: label, detailValue: value });
    return `#/products?${params.toString()}`;
  }

  function activeDetailFilter() {
    if (!state.detailFilterKey || !state.detailFilterLabel || !state.detailFilterValue) return null;
    return {
      key: state.detailFilterKey,
      label: state.detailFilterLabel,
      value: state.detailFilterValue,
    };
  }

  async function loadDetailIndex() {
    if (detailIndex) return detailIndex;
    if (!detailIndexPromise) {
      detailIndexPromise = fetch('./data/detail-index.json', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => {
          detailIndex = data && typeof data.filters === 'object' && data.filters ? data.filters : {};
          return detailIndex;
        })
        .finally(() => {
          detailIndexPromise = null;
        });
    }
    return detailIndexPromise;
  }

  globalThis.filteredProducts = function filteredProductsWithDetailFilter(
    source = state.data.products,
  ) {
    const items = originalFilteredProducts(source);
    const filter = activeDetailFilter();
    if (!filter) return items;

    const matchingIds = new Set((detailIndex?.[filter.key] ?? []).map(Number));
    return items.filter((product) => matchingIds.has(product.id));
  };

  function addActiveFilterNotice() {
    const filter = activeDetailFilter();
    if (!filter || app.querySelector('.viewer-detail-filter')) return;

    const notice = document.createElement('div');
    notice.className = 'viewer-note viewer-detail-filter';
    notice.innerHTML = `絞り込み: <strong>${esc(filter.label)}</strong> = ${esc(filter.value)}　<a href="#/products">解除</a>`;
    const toolbar = app.querySelector('.toolbar.panel');
    if (toolbar) toolbar.after(notice);
    else app.querySelector('.section-title')?.after(notice);
  }

  globalThis.renderProducts = function renderProductsWithDetailFilter(...args) {
    const result = originalRenderProducts(...args);
    addActiveFilterNotice();
    return result;
  };

  function addDetailValueLinks() {
    app.querySelectorAll('.details-list > div').forEach((row) => {
      const label = row.querySelector('dt')?.textContent?.trim() ?? '';
      const valueElement = row.querySelector('dd');
      const value = valueElement?.textContent?.trim() ?? '';
      if (!label || !value || !valueElement || valueElement.querySelector('a')) return;

      const link = document.createElement('a');
      link.href = detailFilterHref(label, value);
      link.textContent = value;
      link.title = `${label}「${value}」で商品を絞り込む`;
      valueElement.replaceChildren(link);
    });
  }

  globalThis.renderProduct = async function renderProductWithDetailLinks(id) {
    await originalRenderProduct(id);
    addDetailValueLinks();
  };

  function setDetailFilterFromHash(hash) {
    if (!hash.startsWith('#/products?')) {
      if (hash === '#/products' || hash === '') {
        state.detailFilterLabel = '';
        state.detailFilterValue = '';
        state.detailFilterKey = '';
      }
      return null;
    }

    const params = new URLSearchParams(hash.slice(hash.indexOf('?') + 1));
    const label = params.get('detailLabel')?.trim() ?? '';
    const value = params.get('detailValue')?.trim() ?? '';
    if (!label || !value) {
      state.detailFilterLabel = '';
      state.detailFilterValue = '';
      state.detailFilterKey = '';
      return null;
    }

    const key = detailFilterKey(label, value);
    const changed = key !== state.detailFilterKey;
    state.detailFilterLabel = label;
    state.detailFilterValue = value;
    state.detailFilterKey = key;
    if (changed) {
      state.query = '';
      state.brand = '';
      state.page = 1;
    }
    return { label, value, key };
  }

  globalThis.route = function routeWithDetailFilter() {
    const requestedHash = location.hash || '#/products';
    const filter = setDetailFilterFromHash(requestedHash);
    if (!filter) return originalRoute();

    app.innerHTML = '<div class="panel loading">商品詳細の絞り込みを読み込んでいます…</div>';
    return loadDetailIndex()
      .then(() => {
        if ((location.hash || '#/products') !== requestedHash) return;
        originalRoute();
      })
      .catch(() => {
        if ((location.hash || '#/products') !== requestedHash) return;
        app.innerHTML = '<div class="panel empty">商品詳細の絞り込みデータがありません。メインPCで viewer:publish を実行してください。</div>';
      });
  };
})();