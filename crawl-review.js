(() => {
  const originalRoute = globalThis.route;
  if (typeof originalRoute !== 'function') return;

  const REPOSITORY = 'Kenu4000/pricewave-girls';
  const NEW_ISSUE_URL = `https://github.com/${REPOSITORY}/issues/new`;
  const CONFIRMED_ONE_KEY = 'pricewave:crawl-review:confirmed-one';
  const PENDING_KEY = 'pricewave:crawl-review:pending-issues';
  const PENDING_GRACE_MS = 5 * 60 * 1000;
  const intervalLabels = { '1': '1日', '3': '3日', '7': '7日', '14': '14日', off: '無' };

  let requestHistory = [];
  let openRequestsByProduct = new Map();
  let issuesLoaded = false;
  let issuesError = '';
  let issuesLoading = null;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function confirmedOneMap() {
    return readJson(CONFIRMED_ONE_KEY, {});
  }

  function pendingMap() {
    return readJson(PENDING_KEY, {});
  }

  function reconcileLocalState() {
    if (!state.data?.products) return;
    const byId = new Map(state.data.products.map((product) => [String(product.id), product]));

    const confirmed = confirmedOneMap();
    let confirmedChanged = false;
    for (const id of Object.keys(confirmed)) {
      const product = byId.get(id);
      if (!product || product.crawlIntervalDays !== 1) {
        delete confirmed[id];
        confirmedChanged = true;
      }
    }
    if (confirmedChanged) writeJson(CONFIRMED_ONE_KEY, confirmed);

    const pending = pendingMap();
    let pendingChanged = false;
    const now = Date.now();
    for (const [id, createdAt] of Object.entries(pending)) {
      const product = byId.get(id);
      if (!product || product.crawlIntervalDays !== 1 || openRequestsByProduct.has(Number(id))) {
        delete pending[id];
        pendingChanged = true;
        continue;
      }
      if (!Number.isFinite(Number(createdAt)) || now - Number(createdAt) > PENDING_GRACE_MS) {
        delete pending[id];
        pendingChanged = true;
      }
    }
    if (pendingChanged) writeJson(PENDING_KEY, pending);
  }

  async function loadRequests({ force = false } = {}) {
    if (issuesLoading) return issuesLoading;
    issuesLoading = (async () => {
      try {
        const helper = globalThis.PricewaveCrawlIssue;
        if (!helper) throw new Error('Issue確認処理を読み込めませんでした。');
        const requests = await helper.fetchAllRequests({ force });
        requestHistory = requests;
        openRequestsByProduct = new Map();
        for (const request of requests) {
          if (request.state === 'open' && !openRequestsByProduct.has(request.productId)) {
            openRequestsByProduct.set(request.productId, request);
          }
        }
        issuesError = '';
      } catch (error) {
        issuesError = error instanceof Error ? error.message : 'GitHub Issueを確認できませんでした。';
      } finally {
        issuesLoaded = true;
        issuesLoading = null;
        reconcileLocalState();
      }
    })();
    return issuesLoading;
  }

  function activePendingIds() {
    const source = pendingMap();
    const now = Date.now();
    return new Set(
      Object.entries(source)
        .filter(([, createdAt]) => Number.isFinite(Number(createdAt)) && now - Number(createdAt) <= PENDING_GRACE_MS)
        .map(([id]) => Number(id)),
    );
  }

  function snapshotIsOlderThanRequest(productId) {
    const helper = globalThis.PricewaveCrawlIssue;
    return Boolean(
      helper?.hasRequestNewerThanSnapshot(
        productId,
        state.data?.generatedAt,
        requestHistory,
      ),
    );
  }

  function candidates() {
    reconcileLocalState();
    const confirmed = confirmedOneMap();
    const pending = activePendingIds();
    return (state.data?.products || []).filter((product) =>
      product.crawlIntervalDays === 1
      && !confirmed[String(product.id)]
      && !openRequestsByProduct.has(product.id)
      && !pending.has(product.id)
      && !snapshotIsOlderThanRequest(product.id)
    );
  }

  function markConfirmedOne(product) {
    const confirmed = confirmedOneMap();
    confirmed[String(product.id)] = {
      title: product.title,
      confirmedAt: new Date().toISOString(),
    };
    writeJson(CONFIRMED_ONE_KEY, confirmed);
    renderCrawlReview();
  }

  function issueUrl(product, interval) {
    const intervalValue = String(interval);
    const label = intervalLabels[intervalValue] || intervalValue;
    const marker = `<!-- pricewave-crawl-interval-request product:${product.id} interval:${intervalValue} -->`;
    const viewerGeneratedAt = state.data?.generatedAt || '';
    const body = [
      marker,
      '## 巡回周期変更',
      '',
      `- 商品ID: ${product.id}`,
      `- 商品名: ${product.title}`,
      '- 現在: 1日',
      `- 変更先: ${label}`,
      viewerGeneratedAt ? `- Viewerデータ: ${viewerGeneratedAt}` : '',
      '',
      `商品: https://Kenu4000.github.io/pricewave-girls/#/products/${product.id}`,
      '',
      'Viewerの「周期振り分け」から作成。',
    ].filter(Boolean).join('\n');
    const title = `[巡回周期変更] #${product.id} → ${label} ${product.title}`;
    const params = new URLSearchParams({ title, body });
    return `${NEW_ISSUE_URL}?${params.toString()}`;
  }

  async function requestIntervalChange(product, interval) {
    const helper = globalThis.PricewaveCrawlIssue;
    if (!helper) {
      window.open(issueUrl(product, interval), '_blank', 'noopener,noreferrer');
      return;
    }

    const popup = helper.openPlaceholder();
    try {
      await loadRequests({ force: true });
      const existing = openRequestsByProduct.get(product.id);
      if (existing?.url) {
        helper.navigate(popup, existing.url);
        renderCrawlReview();
        return;
      }

      const pending = pendingMap();
      pending[String(product.id)] = Date.now();
      writeJson(PENDING_KEY, pending);
      helper.navigate(popup, issueUrl(product, interval));
      renderCrawlReview();
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      issuesError = error instanceof Error ? error.message : 'GitHub Issueを確認できませんでした。';
      renderCrawlReview();
    }
  }

  function reviewCard(product, remaining, totalOneDay) {
    const stock = product.stockStatus === 'out_of_stock' ? '在庫なし' : product.stockStatus === 'in_stock' ? '在庫あり' : '在庫不明';
    const release = product.releaseDate ? esc(product.releaseDate.replaceAll('-', '/')) : '未登録';
    const image = product.imageUrl
      ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.title)}">`
      : '<span class="muted">No Image</span>';
    return `<section class="panel crawl-review-card">
      <div class="crawl-review-progress"><strong>残り ${remaining.toLocaleString('ja-JP')}件</strong><span>1日設定 全${totalOneDay.toLocaleString('ja-JP')}件から確認</span></div>
      <div class="crawl-review-product">
        <a class="crawl-review-image" href="#/products/${product.id}">${image}</a>
        <div class="crawl-review-info">
          <span class="crawl-review-id">#${product.id}</span>
          <h2>${esc(product.title)}</h2>
          <dl class="facts">
            <div><dt>ブランド</dt><dd>${esc(product.manufacturer || '未登録')}</dd></div>
            <div><dt>発売日</dt><dd>${release}</dd></div>
            <div><dt>販売</dt><dd>${yen(product.latestSalePrice)}</dd></div>
            <div><dt>買取</dt><dd>${yen(product.latestBuyPrice)}</dd></div>
            <div><dt>在庫</dt><dd>${stock}</dd></div>
          </dl>
          <a class="button crawl-review-detail" href="#/products/${product.id}" target="_blank" rel="noreferrer">商品詳細を開く</a>
        </div>
      </div>
      <div class="crawl-review-question">この商品の巡回周期は？</div>
      <div class="crawl-review-actions">
        <button class="crawl-review-choice one" data-review-keep="1">1日のまま</button>
        <button class="crawl-review-choice three" data-review-interval="3">3日</button>
        <button class="crawl-review-choice seven" data-review-interval="7">7日</button>
        <button class="crawl-review-choice fourteen" data-review-interval="14">14日</button>
        <button class="crawl-review-choice off" data-review-interval="off">無</button>
      </div>
      <p class="crawl-review-note">変更先を選ぶと、その場で同じ商品の未処理Issueを再確認します。既に依頼があれば新規作成せず既存Issueを開きます。「1日のまま」はこのViewerで確認済みとして保存します。</p>
    </section>`;
  }

  function bindReviewActions(product) {
    const keep = document.querySelector('[data-review-keep]');
    if (keep) keep.addEventListener('click', () => markConfirmedOne(product));
    document.querySelectorAll('[data-review-interval]').forEach((button) => {
      button.addEventListener('click', () => void requestIntervalChange(product, button.dataset.reviewInterval));
    });
    const refresh = document.querySelector('[data-review-refresh]');
    if (refresh) refresh.addEventListener('click', async () => {
      issuesLoaded = false;
      await loadRequests({ force: true });
      renderCrawlReview();
    });
  }

  async function renderCrawlReview() {
    if (!state.data?.products) return;
    const totalOneDay = state.data.products.filter((product) => product.crawlIntervalDays === 1).length;

    if (!issuesLoaded) {
      app.innerHTML = `<div class="section-title"><h1>周期振り分け</h1></div><div class="panel loading">GitHub Issueと1日設定の商品を確認しています…</div>`;
      await loadRequests();
      if (!location.hash.startsWith('#/crawl-review')) return;
    }

    const items = candidates();
    const product = items[0];
    const confirmedCount = Object.keys(confirmedOneMap()).length;
    const pendingCount = openRequestsByProduct.size + activePendingIds().size;

    app.innerHTML = `<div class="section-title crawl-review-heading">
      <div><h1>周期振り分け</h1><p class="muted">1日設定の商品を1件ずつ確認します。</p></div>
      <div class="crawl-review-summary"><span>確認済み1日 ${confirmedCount.toLocaleString('ja-JP')}件</span><span>変更依頼中 ${pendingCount.toLocaleString('ja-JP')}件</span></div>
    </div>
    ${issuesError ? `<div class="viewer-note crawl-review-warning">${esc(issuesError)}　Issueの除外判定は最新でない可能性があります。<button data-review-refresh>再確認</button></div>` : ''}
    ${product
      ? reviewCard(product, items.length, totalOneDay)
      : `<div class="panel crawl-review-complete"><h2>確認対象はありません</h2><p>現在のViewerデータで未確認かつ変更依頼のない1日商品はありません。Viewerより新しいIssueがある商品も、次回データ更新までは再表示しません。</p><button data-review-refresh>Issueを再確認</button></div>`}`;

    if (product) bindReviewActions(product);
    else {
      const refresh = document.querySelector('[data-review-refresh]');
      if (refresh) refresh.addEventListener('click', async () => {
        issuesLoaded = false;
        await loadRequests({ force: true });
        renderCrawlReview();
      });
    }
  }

  function routeWithCrawlReview() {
    if (location.hash.startsWith('#/crawl-review')) {
      void renderCrawlReview();
      return;
    }
    return originalRoute();
  }

  globalThis.route = routeWithCrawlReview;
})();
