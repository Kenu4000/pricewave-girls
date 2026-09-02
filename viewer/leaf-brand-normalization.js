(() => {
  const LEAF_KEYS = new Set([
    'leaf',
    'リーフ',
    'aquaplus',
    'アクアプラス',
    'aquaplusアクアプラス',
  ]);

  function normalizeKey(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('ja')
      .replace(/[\s\p{P}\p{S}]/gu, '');
  }

  function normalizeManufacturer(value) {
    return LEAF_KEYS.has(normalizeKey(value)) ? 'Leaf' : value;
  }

  function normalizeProduct(product) {
    if (!product || typeof product !== 'object') return;
    product.manufacturer = normalizeManufacturer(product.manufacturer);
  }

  function normalizeViewerData() {
    if (!state?.data) return;
    for (const product of state.data.products || []) normalizeProduct(product);
    for (const change of state.data.priceChanges || []) normalizeProduct(change.product);
    if (LEAF_KEYS.has(normalizeKey(state.brand))) state.brand = 'Leaf';
  }

  for (const name of ['renderProducts', 'renderChanges', 'renderProduct']) {
    const original = globalThis[name];
    if (typeof original !== 'function') continue;
    globalThis[name] = function normalizeLeafBeforeRender(...args) {
      normalizeViewerData();
      return original.apply(this, args);
    };
  }
})();
