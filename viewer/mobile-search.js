(() => {
  const originalRenderProducts = globalThis.renderProducts;
  if (typeof originalRenderProducts !== 'function') return;

  function bindStandardPager(results) {
    results.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        state.page = Number(button.dataset.page);
        renderStandardResults();
        scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function viewerBrandGroups() {
    const counts = new Map();
    for (const product of state.data.products) {
      const brand = String(product.manufacturer || '').trim();
      if (!brand) continue;
      counts.set(brand, (counts.get(brand) || 0) + 1);
    }

    const alphabetical = [...counts.keys()]
      .sort((left, right) => left.localeCompare(right, 'ja'));
    const featured = alphabetical
      .filter((brand) => counts.get(brand) >= 2)
      .sort((left, right) => {
        const countDifference = counts.get(right) - counts.get(left);
        return countDifference || left.localeCompare(right, 'ja');
      })
      .slice(0, 12);

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

  function renderStandardResults() {
    const results = document.querySelector('#viewer-product-results');
    if (!results) return;

    const items = filteredProducts();
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
    // 閲覧履歴は検索ツールバーを持たないため、従来の描画処理をそのまま使う。
    if (customProducts) {
      return originalRenderProducts(customProducts, title);
    }

    app.innerHTML = `<div class="section-title"><h1>${esc(title)}</h1><span class="muted" id="viewer-product-count"></span></div>
      <div class="toolbar panel"><input class="search" id="q" value="${esc(state.query)}" placeholder="商品名で検索"><select id="brand">${viewerBrandOptions()}</select><select id="sort"><option value="updated_desc" ${state.sort === 'updated_desc' ? 'selected' : ''}>更新が新しい順</option><option value="updated_asc" ${state.sort === 'updated_asc' ? 'selected' : ''}>更新が古い順</option><option value="sale_asc" ${state.sort === 'sale_asc' ? 'selected' : ''}>販売価格が安い順</option><option value="sale_desc" ${state.sort === 'sale_desc' ? 'selected' : ''}>販売価格が高い順</option><option value="release_desc" ${state.sort === 'release_desc' ? 'selected' : ''}>発売日が新しい順</option><option value="title_asc" ${state.sort === 'title_asc' ? 'selected' : ''}>商品名順</option></select><select id="per"><option ${state.perPage === 24 ? 'selected' : ''}>24</option><option ${state.perPage === 48 ? 'selected' : ''}>48</option><option ${state.perPage === 96 ? 'selected' : ''}>96</option></select></div>
      <div id="viewer-product-results"></div>`;

    // 入力中は検索欄をDOMから外さず、結果領域だけ更新する。
    // これによりiOS等のモバイルでフォーカスや日本語IMEが1文字ごとに切れない。
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