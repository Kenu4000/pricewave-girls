(() => {
  const app = document.querySelector('#app');
  const runtime = globalThis.PricewaveViewerEnhancements;
  if (!app || typeof runtime?.register !== 'function') return;

  const PLATFORM_PREFIX = /^(?:Windows|Macintosh|Mac(?:\s*OS)?|PC[- ]?98|X68000|FM[- ]?TOWNS|MS[- ]?DOS|DOS)/iu;
  const SOFTWARE_PREFIX = /^(.{1,100}?ソフト)[\s　]+(.+)$/u;

  function formatProductDisplayTitle(value) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed || !PLATFORM_PREFIX.test(trimmed)) return trimmed;
    const match = SOFTWARE_PREFIX.exec(trimmed);
    if (!match) return trimmed;
    const suffix = match[1].trim();
    const title = match[2].trim();
    return title && suffix ? `${title}　${suffix}` : trimmed;
  }

  function rewriteText(element) {
    const before = element.textContent?.trim() || '';
    const after = formatProductDisplayTitle(before);
    if (after !== before) element.textContent = after;
    const titleAttribute = element.getAttribute?.('title');
    if (titleAttribute) {
      const formattedTitle = formatProductDisplayTitle(titleAttribute);
      if (formattedTitle !== titleAttribute) element.setAttribute('title', formattedTitle);
    }
  }

  function enhance() {
    // 商品名を表示する主要箇所だけを対象にし、検索用・内部データのtitleは変更しない。
    app.querySelectorAll([
      '.product-title',
      '.change-product a',
      '.change-product-link span',
      '.viewer-change-product-title',
      'h1',
      'h2',
      '[data-legend-product] b',
    ].join(',')).forEach(rewriteText);

    app.querySelectorAll('img[alt]').forEach((image) => {
      const before = image.getAttribute('alt') || '';
      const after = formatProductDisplayTitle(before);
      if (after !== before) image.setAttribute('alt', after);
    });
  }

  globalThis.PricewaveProductTitleDisplay = { formatProductDisplayTitle };
  runtime.register('product-title-display', enhance);
})();
