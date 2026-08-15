(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  const intervalMeta = (value) => {
    if (value === null) return { label: '無', key: 'off' };
    if (value === 1) return { label: '1日', key: 'one' };
    if (value === 3) return { label: '3日', key: 'three' };
    if (value === 7) return { label: '7日', key: 'seven' };
    if (value === 14) return { label: '14日', key: 'fourteen' };
    return null;
  };

  const dataPromise = fetch('./data/index.json', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('viewer index unavailable');
      return response.json();
    })
    .then((data) => new Map(
      (Array.isArray(data?.products) ? data.products : [])
        .map((product) => [String(product.id), product.crawlIntervalDays]),
    ))
    .catch(() => new Map());

  function badge(value, detail = false) {
    const meta = intervalMeta(value);
    if (!meta) return null;
    const element = document.createElement('span');
    element.className = `badge crawl-interval-badge crawl-interval-${meta.key}`;
    element.textContent = detail ? `巡回周期 ${meta.label}` : `巡回: ${meta.label}`;
    element.title = `自動巡回周期: ${meta.label}`;
    return element;
  }

  async function decorate() {
    const intervals = await dataPromise;

    for (const card of app.querySelectorAll('a.product-card[href^="#/products/"]')) {
      if (card.querySelector('.crawl-interval-badge')) continue;
      const id = card.getAttribute('href')?.match(/^#\/products\/(\d+)/)?.[1];
      if (!id || !intervals.has(id)) continue;
      const element = badge(intervals.get(id));
      if (!element) continue;
      (card.querySelector('.price-row') || card).appendChild(element);
    }

    const detailId = location.hash.match(/^#\/products\/(\d+)/)?.[1];
    if (!detailId || !intervals.has(detailId)) return;
    const prices = app.querySelector('.detail-prices');
    if (!prices || prices.querySelector('.crawl-interval-badge')) return;
    const element = badge(intervals.get(detailId), true);
    if (element) prices.appendChild(element);
  }

  let queued = false;
  function scheduleDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      void decorate();
    });
  }

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleDecorate);
  scheduleDecorate();
})();
