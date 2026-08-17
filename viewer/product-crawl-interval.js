(() => {
  const REPOSITORY = 'Kenu4000/pricewave-girls';
  const NEW_ISSUE_URL = `https://github.com/${REPOSITORY}/issues/new`;
  const options = [
    { value: '1', label: '1日', tone: 'one' },
    { value: '3', label: '3日', tone: 'three' },
    { value: '7', label: '7日', tone: 'seven' },
    { value: '14', label: '14日', tone: 'fourteen' },
    { value: 'off', label: '無', tone: 'off' },
  ];

  function intervalKey(value) {
    return value == null ? 'off' : String(value);
  }

  function intervalLabel(value) {
    return options.find((option) => option.value === intervalKey(value))?.label || String(value);
  }

  function currentProduct() {
    const match = location.hash.match(/^#\/products\/(\d+)/u);
    if (!match || !state.data?.products) return null;
    const id = Number(match[1]);
    return state.data.products.find((product) => product.id === id) || null;
  }

  function issueUrl(product, nextInterval) {
    const nextLabel = intervalLabel(nextInterval === 'off' ? null : Number(nextInterval));
    const currentLabel = intervalLabel(product.crawlIntervalDays);
    const marker = `<!-- pricewave-crawl-interval-request product:${product.id} interval:${nextInterval} -->`;
    const body = [
      marker,
      '## 巡回周期変更',
      '',
      `- 商品ID: ${product.id}`,
      `- 商品名: ${product.title}`,
      `- 現在: ${currentLabel}`,
      `- 変更先: ${nextLabel}`,
      state.data?.generatedAt ? `- Viewerデータ: ${state.data.generatedAt}` : '',
      '',
      `商品: https://Kenu4000.github.io/pricewave-girls/#/products/${product.id}`,
      '',
      'Viewerの商品詳細から作成。',
    ].filter(Boolean).join('\n');
    const title = `[巡回周期変更] #${product.id} ${currentLabel} → ${nextLabel} ${product.title}`;
    return `${NEW_ISSUE_URL}?${new URLSearchParams({ title, body }).toString()}`;
  }

  function mount() {
    const product = currentProduct();
    if (!product || document.querySelector('#viewer-product-crawl-interval')) return;

    const overview = app.querySelector('section.panel.block');
    if (!overview) return;

    const current = intervalKey(product.crawlIntervalDays);
    const panel = document.createElement('section');
    panel.id = 'viewer-product-crawl-interval';
    panel.className = 'panel block product-crawl-interval-panel';
    panel.innerHTML = `
      <div class="product-crawl-interval-copy">
        <strong>巡回周期</strong>
        <span>この商品を取得する頻度</span>
        <span class="product-crawl-interval-status" aria-live="polite"></span>
      </div>
      <div class="product-crawl-interval-buttons" role="group" aria-label="この商品の巡回周期">
        ${options.map((option) => `
          <button
            type="button"
            class="product-crawl-interval-button tone-${option.tone}"
            data-product-crawl-interval="${option.value}"
            aria-pressed="${option.value === current ? 'true' : 'false'}"
          >${option.label}</button>`).join('')}
      </div>
      <span class="product-crawl-interval-note">Viewerでは変更先を選ぶとGitHub Issue作成画面を開きます。</span>`;

    overview.insertAdjacentElement('afterend', panel);
    const status = panel.querySelector('.product-crawl-interval-status');
    panel.querySelectorAll('[data-product-crawl-interval]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.productCrawlInterval || '';
        if (!next || next === current) return;
        window.open(issueUrl(product, next), '_blank', 'noopener,noreferrer');
        if (status) status.textContent = `${intervalLabel(next === 'off' ? null : Number(next))}への変更依頼を開きました`;
      });
    });
  }

  let scheduled = false;
  function scheduleMount() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      mount();
    });
  }

  new MutationObserver(scheduleMount).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleMount);
  scheduleMount();
})();
