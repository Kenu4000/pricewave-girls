(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  function collapsePriceHistory() {
    for (const section of app.querySelectorAll('section.panel.block')) {
      if (section.dataset.priceHistoryCollapsed === 'true') continue;
      const heading = section.querySelector('.section-title h2');
      if (heading?.textContent?.trim() !== '価格履歴') continue;

      const titleRow = section.querySelector('.section-title');
      const table = section.querySelector('.table-wrap');
      if (!titleRow || !table) continue;

      const note = titleRow.querySelector('.muted')?.textContent?.trim() || '';
      const details = document.createElement('details');
      details.className = 'viewer-price-history-details';

      const summary = document.createElement('summary');
      summary.className = 'viewer-price-history-summary';
      const title = document.createElement('strong');
      title.textContent = '価格履歴';
      summary.appendChild(title);
      if (note) {
        const meta = document.createElement('span');
        meta.className = 'muted';
        meta.textContent = note;
        summary.appendChild(meta);
      }

      details.append(summary, table);
      section.dataset.priceHistoryCollapsed = 'true';
      section.replaceChildren(details);
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      collapsePriceHistory();
    });
  }

  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
  schedule();
})();
