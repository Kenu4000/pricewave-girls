(() => {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const DETAIL_INDEX_PATTERN = /(?:^|\/)data\/detail-index\.json(?:[?#]|$)/u;
  let detailIndexReleased = false;
  let releaseDetailIndex;
  const detailIndexGate = new Promise((resolve) => {
    releaseDetailIndex = resolve;
  });

  // mobile-search.jsは従来どおり起動時にdetail-indexを要求するが、
  // 商品一覧を開くまでは実ネットワーク要求を保留する。
  globalThis.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!DETAIL_INDEX_PATTERN.test(url) || detailIndexReleased) {
      return nativeFetch(input, init);
    }
    return detailIndexGate.then(() => nativeFetch(input, init));
  };

  function allowDetailIndex() {
    if (detailIndexReleased) return;
    detailIndexReleased = true;
    releaseDetailIndex();
  }

  async function loadJson(path) {
    const response = await nativeFetch(path, { cache: 'no-store' });
    if (!response.ok) {
      const error = new Error(`${path} を読み込めませんでした: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function legacySnapshotAvailable() {
    return state.data && state.data.splitData !== true;
  }

  let changesPromise = null;
  let productsPromise = null;
  let searchIndexPromise = null;
  let searchIndexLoaded = false;

  async function ensureChanges() {
    if (legacySnapshotAvailable() && Array.isArray(state.data.priceChanges)) {
      return state.data.priceChanges;
    }
    if (!changesPromise) {
      changesPromise = loadJson('./data/changes.json')
        .then((data) => {
          const changes = Array.isArray(data?.priceChanges) ? data.priceChanges : [];
          state.data.priceChanges = changes;
          return changes;
        })
        .catch(async (error) => {
          // 公開中gh-pagesがまだ旧一体型snapshotなら互換読み込みへ戻す。
          if (error?.status !== 404) throw error;
          const legacy = await loadJson('./data/index.json');
          const changes = Array.isArray(legacy?.priceChanges) ? legacy.priceChanges : [];
          state.data.priceChanges = changes;
          return changes;
        });
    }
    return changesPromise;
  }

  async function ensureProducts() {
    allowDetailIndex();
    if (legacySnapshotAvailable() && Array.isArray(state.data.products)) {
      await ensureChanges();
      return state.data.products;
    }
    if (!productsPromise) {
      productsPromise = Promise.all([
        loadJson('./data/products.json'),
        ensureChanges(),
      ])
        .then(([data]) => {
          const products = Array.isArray(data?.products) ? data.products : [];
          state.data.products = products;
          updateCountdown();
          globalThis.dispatchEvent(new CustomEvent('pricewave:viewer-products-loaded'));
          return products;
        })
        .catch(async (error) => {
          if (error?.status !== 404) throw error;
          const legacy = await loadJson('./data/index.json');
          const products = Array.isArray(legacy?.products) ? legacy.products : [];
          state.data.products = products;
          if (Array.isArray(legacy?.priceChanges)) state.data.priceChanges = legacy.priceChanges;
          updateCountdown();
          globalThis.dispatchEvent(new CustomEvent('pricewave:viewer-products-loaded'));
          return products;
        });
    }
    return productsPromise;
  }

  async function ensureSearchIndex() {
    if (searchIndexLoaded) return;
    if (!searchIndexPromise) {
      searchIndexPromise = ensureProducts()
        .then(async (products) => {
          // 旧snapshotでは商品要約自身にsearchTextが含まれるため追加取得不要。
          if (legacySnapshotAvailable() && products.some((product) => product.searchText)) {
            searchIndexLoaded = true;
            return;
          }
          const data = await loadJson('./data/search-index.json');
          const byId = data?.searchTextByProductId && typeof data.searchTextByProductId === 'object'
            ? data.searchTextByProductId
            : {};
          for (const product of products) {
            product.searchText = typeof byId[String(product.id)] === 'string'
              ? byId[String(product.id)]
              : '';
          }
          searchIndexLoaded = true;
          globalThis.dispatchEvent(new CustomEvent('pricewave:viewer-search-index-loaded'));
        })
        .catch((error) => {
          searchIndexPromise = null;
          throw error;
        });
    }
    return searchIndexPromise;
  }

  async function lazyRoute() {
    const requestedHash = location.hash || '#/products';
    const match = requestedHash.match(/^#\/products\/(\d+)/);
    if (match) {
      renderProduct(Number(match[1]));
      return;
    }

    app.innerHTML = '<div class="panel loading">データを読み込んでいます…</div>';
    try {
      if (requestedHash.startsWith('#/changes')) {
        await ensureChanges();
        if ((location.hash || '#/products') !== requestedHash) return;
        renderChanges();
      } else {
        await ensureProducts();
        if ((location.hash || '#/products') !== requestedHash) return;
        if (state.query?.trim()) await ensureSearchIndex();
        if ((location.hash || '#/products') !== requestedHash) return;
        if (requestedHash.startsWith('#/history')) {
          renderHistory();
        } else {
          state.page = 1;
          const render = typeof globalThis.renderProducts === 'function'
            ? globalThis.renderProducts
            : renderProducts;
          render();
        }
      }
      globalThis.dispatchEvent(new CustomEvent('pricewave:viewer-rendered'));
    } catch (error) {
      console.error('Viewer分割データの読み込みに失敗しました。', error);
      app.innerHTML = '<div class="panel empty">Viewerデータを読み込めませんでした。</div>';
    }
  }

  // app.jsのbootstrap fetch完了後に呼ばれるrouteを差し替える。
  route = lazyRoute;
  globalThis.PricewaveViewerData = {
    ensureChanges,
    ensureProducts,
    ensureSearchIndex,
    allowDetailIndex,
    get searchIndexLoaded() {
      return searchIndexLoaded;
    },
  };

  // 検索文字列の巨大索引は、実際に検索ボタンが押されるまで取得しない。
  // captureでmobile-search.jsのsubmit処理より先に止め、索引読込後に同じsubmitを再送する。
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'viewer-product-search') return;
    const query = form.querySelector('#q')?.value?.trim() || '';
    if (!query || searchIndexLoaded) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const submitter = event.submitter;
    void ensureSearchIndex()
      .then(() => {
        if (!form.isConnected) return;
        form.requestSubmit(submitter instanceof HTMLElement ? submitter : undefined);
      })
      .catch((error) => {
        console.error('Viewer検索索引の読み込みに失敗しました。', error);
        if (form.isConnected) form.requestSubmit(submitter instanceof HTMLElement ? submitter : undefined);
      });
  }, true);
})();
