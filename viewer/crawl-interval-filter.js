(() => {
  const originalFilteredProducts = globalThis.filteredProducts;
  const originalRenderProducts = globalThis.renderProducts;
  if (typeof originalFilteredProducts !== 'function' || typeof originalRenderProducts !== 'function') return;

  const options = [
    { value: '', label: 'すべて', tone: 'all' },
    { value: '1', label: '1日', tone: 'one' },
    { value: '3', label: '3日', tone: 'three' },
    { value: '7', label: '7日', tone: 'seven' },
    { value: '14', label: '14日', tone: 'fourteen' },
    { value: 'off', label: '無', tone: 'off' },
  ];

  state.crawlInterval = state.crawlInterval || '';

  function matchesCrawlInterval(product) {
    if (!state.crawlInterval) return true;
    if (state.crawlInterval === 'off') return product.crawlIntervalDays == null;
    return Number(product.crawlIntervalDays) === Number(state.crawlInterval);
  }

  globalThis.filteredProducts = function filteredProductsWithCrawlInterval(source = state.data.products) {
    return originalFilteredProducts(source).filter(matchesCrawlInterval);
  };

  function mountFilter() {
    const toolbar = app.querySelector('.toolbar');
    if (!toolbar || app.querySelector('#viewer-crawl-interval-filter')) return;

    const panel = document.createElement('section');
    panel.id = 'viewer-crawl-interval-filter';
    panel.className = 'crawl-interval-filter panel';
    panel.setAttribute('aria-label', '巡回周期で絞り込み');
    panel.innerHTML = `
      <div class="crawl-interval-filter-copy">
        <strong>巡回周期で絞り込み</strong>
        <span>設定されている周期の商品を一覧表示</span>
      </div>
      <div class="crawl-interval-filter-buttons" role="group" aria-label="巡回周期">
        ${options.map((option) => {
          const selected = option.value === state.crawlInterval;
          return `<button type="button" class="crawl-interval-filter-button tone-${option.tone}" data-crawl-interval="${option.value}" aria-pressed="${selected ? 'true' : 'false'}">${option.label}</button>`;
        }).join('')}
      </div>`;

    toolbar.insertAdjacentElement('beforebegin', panel);
    panel.querySelectorAll('[data-crawl-interval]').forEach((button) => {
      button.addEventListener('click', () => {
        state.crawlInterval = button.dataset.crawlInterval || '';
        state.page = 1;
        globalThis.renderProducts();
      });
    });
  }

  globalThis.renderProducts = function renderProductsWithCrawlInterval(customProducts = null, title = '商品一覧') {
    const result = originalRenderProducts(customProducts, title);
    if (!customProducts) mountFilter();
    return result;
  };
})();
