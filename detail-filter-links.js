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
  const PEOPLE_DETAIL_LABELS = new Set(['原画', '原画家', 'シナリオ', '脚本', '声優', 'キャスト']);

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

  function splitDetailValues(label, value) {
    const normalizedLabel = String(label ?? '').normalize('NFKC').trim();
    if (!PEOPLE_DETAIL_LABELS.has(normalizedLabel)) return [value];
    const values = String(value ?? '')
      .split(/\s*(?:、|,|，|\/|／|;|；|\r?\n)\s*/u)
      .map((part) => part.normalize('NFKC').replace(/\s+/gu, ' ').trim())
      .filter(Boolean);
    return values.length > 1 ? values : [value];
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

  function detailFilterIds(filter) {
    const exact = detailIndex?.[filter.key];
    if (Array.isArray(exact)) return exact.map(Number);

    const normalizedLabel = String(filter.label ?? '').normalize('NFKC').trim();
    if (!PEOPLE_DETAIL_LABELS.has(normalizedLabel)) return [];

    const labelPrefix = `${normalizeDetailPart(filter.label)}\u0000`;
    const valueKey = normalizeDetailPart(filter.value);
    if (!valueKey) return [];

    const ids = new Set();
    for (const [key, productIds] of Object.entries(detailIndex ?? {})) {
      if (!key.startsWith(labelPrefix)) continue;
      const indexedValue = key.slice(labelPrefix.length);
      if (!indexedValue.includes(valueKey) || !Array.isArray(productIds)) continue;
      productIds.forEach((id) => ids.add(Number(id)));
    }
    return [...ids];
  }

  globalThis.filteredProducts = function filteredProductsWithDetailFilter(
    source = state.data.products,
  ) {
    const items = originalFilteredProducts(source);
    const filter = activeDetailFilter();
    if (!filter) return items;

    const matchingIds = new Set(detailFilterIds(filter));
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

      const parts = splitDetailValues(label, value);
      const nodes = [];
      parts.forEach((part, index) => {
        if (index > 0) nodes.push(document.createTextNode('、'));
        const link = document.createElement('a');
        link.href = detailFilterHref(label, part);
        link.textContent = part;
        link.title = `${label}「${part}」で商品を絞り込む`;
        nodes.push(link);
      });
      valueElement.replaceChildren(...nodes);
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