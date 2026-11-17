(() => {
  const FEATURED_LIMIT = 20;
  const FEATURED_EXCLUDED = new Set(['BEEP', 'AiNO'].map(normalizeBrand));
  const FEATURED_PINNED_ALIASES = [
    ['暁'],
    ['あっぷりけ'],
    ['Purple software', 'パープルソフトウェア', 'Purple software（パープルソフトウェア）'],
    ['Navel', 'NAVEL', 'navel'],
    ['ぱれっと', 'パレット', 'Palette', 'PALETTE'],
  ];
  const featuredCollator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });

  const changeViewState = {
    scope: 'focused',
    page: 1,
    perPage: 50,
  };

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
        featuredCollator.compare(left.value, right.value),
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

  function isOneOrThreeDays(product) {
    const days = Number(product?.crawlIntervalDays);
    return days === 1 || days === 3;
  }

  function focusedProductIds(products) {
    const featured = featuredBrandValues(products);
    const ids = new Set();
    for (const product of products || []) {
      if (featured.has(normalizeBrand(product.manufacturer)) || isOneOrThreeDays(product)) {
        ids.add(Number(product.id));
      }
    }
    return ids;
  }

  function directionOf(change) {
    if (change.currentPrice > change.previousPrice) return 'up';
    if (change.currentPrice < change.previousPrice) return 'down';
    return 'flat';
  }

  function directionLabel(direction) {
    if (direction === 'up') return '値上げ';
    if (direction === 'down') return '値下がり';
    return '変化なし';
  }

  function directionArrow(direction) {
    if (direction === 'up') return '↑';
    if (direction === 'down') return '↓';
    return '→';
  }

  function filteredChanges(changes) {
    const products = Array.isArray(state.data?.products) ? state.data.products : [];
    const scopedIds = changeViewState.scope === 'focused' ? focusedProductIds(products) : null;
    return changes.filter((change) => !scopedIds || scopedIds.has(Number(change.productId)));
  }

  function renderChangeRows(changes) {
    const productsById = new Map((state.data.products || []).map((product) => [Number(product.id), product]));
    return changes.map((change) => {
      const direction = directionOf(change);
      const summary = productsById.get(Number(change.productId));
      const rankB = summary?.conditionRank === 'B' || Boolean(summary?.condition);
      return `<tr class="${rankB ? 'viewer-change-rank-b' : ''}">
        <td data-label="変更日時">${esc(dateTime(change.changedAt))}</td>
        <td class="viewer-change-product-cell" data-label="商品">
          <a class="viewer-change-product-link" href="#/products/${change.productId}">
            ${change.product?.imageUrl ? `<img loading="lazy" src="${esc(change.product.imageUrl)}" alt="">` : ''}
            <span class="viewer-change-product-title" title="${esc(change.product?.title || '')}">${esc(change.product?.title || '')}</span>
          </a>
        </td>
        <td data-label="ブランド">${change.product?.manufacturer ? esc(change.product.manufacturer) : '<span class="muted">未取得</span>'}</td>
        <td data-label="種類">
          <span class="viewer-change-type-with-direction">
            <span class="viewer-change-type-badge ${change.type === 'sale' ? 'sale' : 'buy'}">${change.type === 'sale' ? '販売' : '買取'}</span>
            <span class="viewer-change-direction ${direction}" aria-label="${directionLabel(direction)}" title="${directionLabel(direction)}">${directionArrow(direction)}</span>
          </span>
        </td>
        <td data-label="変更前">${yen(change.previousPrice)}</td>
        <td class="viewer-change-current" data-label="変更後">${yen(change.currentPrice)}</td>
      </tr>`;
    }).join('');
  }

  function bindChangeUi(totalPages) {
    document.querySelectorAll('[data-change-scope]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.changeScope;
        if (next !== 'focused' && next !== 'all') return;
        if (changeViewState.scope === next) return;
        changeViewState.scope = next;
        changeViewState.page = 1;
        renderChanges();
      });
    });

    document.querySelectorAll('[data-change-page]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = Number(button.dataset.changePage);
        if (!Number.isInteger(next) || next < 1 || next > totalPages) return;
        changeViewState.page = next;
        renderChanges();
        scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  renderChanges = function renderChangesMainUi() {
    const allChanges = Array.isArray(state.data?.priceChanges) ? state.data.priceChanges : [];
    const changes = filteredChanges(allChanges);
    const totalPages = Math.max(1, Math.ceil(changes.length / changeViewState.perPage));
    changeViewState.page = Math.min(changeViewState.page, totalPages);
    const start = (changeViewState.page - 1) * changeViewState.perPage;
    const visible = changes.slice(start, start + changeViewState.perPage);

    app.innerHTML = `<section class="viewer-change-page">
      <div class="viewer-change-heading">
        <div>
          <h1>価格変更</h1>
          <p class="muted">${changes.length.toLocaleString('ja-JP')}件</p>
        </div>
        <div class="viewer-change-scope" aria-label="価格変更の表示対象">
          <button type="button" data-change-scope="focused" class="${changeViewState.scope === 'focused' ? 'active' : ''}">注目</button>
          <button type="button" data-change-scope="all" class="${changeViewState.scope === 'all' ? 'active' : ''}">全商品</button>
        </div>
      </div>

      ${visible.length ? `<div class="viewer-change-table-wrap panel">
        <table class="viewer-change-table">
          <thead><tr><th>変更日時</th><th>商品</th><th>ブランド</th><th>種類</th><th>変更前</th><th>変更後</th></tr></thead>
          <tbody>${renderChangeRows(visible)}</tbody>
        </table>
      </div>` : '<div class="panel empty">価格変更はありません。</div>'}

      ${totalPages > 1 ? `<nav class="viewer-change-pagination" aria-label="価格変更のページ">
        <button data-change-page="${Math.max(1, changeViewState.page - 1)}" ${changeViewState.page === 1 ? 'disabled' : ''}>← 前へ</button>
        <span class="viewer-change-page-current">${changeViewState.page} / ${totalPages}</span>
        <button data-change-page="${Math.min(totalPages, changeViewState.page + 1)}" ${changeViewState.page === totalPages ? 'disabled' : ''}>次へ →</button>
      </nav>` : ''}
    </section>`;

    bindChangeUi(totalPages);
  };
})();