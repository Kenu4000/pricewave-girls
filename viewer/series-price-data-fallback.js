(() => {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const SERIES_INDEX_PATTERN = /(?:^|\/)data\/series-index\.json(?:[?#]|$)/u;
  const SERIES_DATA_PATTERN = /(?:^|\/)data\/series\/([^/?#]+)\.json(?:[?#]|$)/u;
  const CATALOG_URLS = Array.from({ length: 6 }, (_, index) =>
    `https://raw.githubusercontent.com/Kenu4000/pricewave-girls/main/data/series-catalog-0${index + 1}.json`,
  );
  const STOREFRONT_PLATFORM_PREFIX = /^(?:Windows|Macintosh|Mac(?:\s*OS)?|PC[- ]?98|X68000|FM[- ]?TOWNS|MS[- ]?DOS|DOS)/iu;
  const STOREFRONT_SOFTWARE_PREFIX = /^.{0,100}?ソフト[\s　]+/u;
  const RANK_B_MARKER = /(?:^|\s)(?:【\s*)?ランク\s*[BＢ](?:\s*】|\s*[)）])\s*/iu;

  let fallbackStatePromise = null;
  const seriesDataPromises = new Map();

  function requestUrl(input) {
    if (input instanceof Request) return input.url;
    return String(input);
  }

  async function json(url) {
    const response = await nativeFetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`failed to load ${url}: ${response.status}`);
    return response.json();
  }

  function stripStorefrontCategoryPrefix(value) {
    const trimmed = String(value ?? '').trim();
    if (!STOREFRONT_PLATFORM_PREFIX.test(trimmed)) return trimmed;
    const prefix = STOREFRONT_SOFTWARE_PREFIX.exec(trimmed);
    return prefix ? trimmed.slice(prefix[0].length).trim() : trimmed;
  }

  function displayProductTitle(value) {
    return String(value ?? '')
      .replace(RANK_B_MARKER, ' ')
      .replace(/\s{2,}/gu, ' ')
      .trim();
  }

  function normalizeTitle(value) {
    return stripStorefrontCategoryPrefix(value)
      .replace(RANK_B_MARKER, ' ')
      .normalize('NFKC')
      .toLocaleLowerCase('ja-JP')
      .replace(/[\s\p{P}]/gu, '')
      .trim();
  }

  function catalogEntries(catalog) {
    return catalog
      .flatMap((series) => series.titles.map((title) => ({
        series,
        title,
        normalized: normalizeTitle(title),
      })))
      .sort((left, right) => right.normalized.length - left.normalized.length);
  }

  function findProductSeries(productTitle, entries) {
    const normalized = normalizeTitle(productTitle);
    if (!normalized) return null;
    const match = entries.find((entry) =>
      normalized === entry.normalized || normalized.startsWith(entry.normalized),
    );
    return match?.series ?? null;
  }

  function findCanonicalTitle(productTitle, series) {
    const normalized = normalizeTitle(productTitle);
    const candidates = series.titles
      .map((title) => ({ title, normalized: normalizeTitle(title) }))
      .sort((left, right) => right.normalized.length - left.normalized.length);
    return candidates.find((candidate) =>
      normalized === candidate.normalized || normalized.startsWith(candidate.normalized),
    )?.title ?? null;
  }

  function isNormalConditionProduct(product) {
    return product.conditionRank !== 'B' && !product.condition;
  }

  async function loadFallbackState() {
    if (fallbackStatePromise) return fallbackStatePromise;
    fallbackStatePromise = Promise.all([
      Promise.all(CATALOG_URLS.map((url) => json(url))).then((parts) => parts.flat()),
      json('./data/index.json'),
    ]).then(([catalog, index]) => {
      const entries = catalogEntries(catalog);
      const seriesById = new Map(catalog.map((series) => [series.id, series]));
      const products = {};
      for (const product of index.products || []) {
        const series = findProductSeries(product.title, entries);
        if (!series) continue;
        products[String(product.id)] = {
          id: series.id,
          name: series.name,
          definedTitleCount: series.titles.length,
          path: `data/series/${series.id}.json`,
        };
      }
      return {
        index: { generatedAt: new Date().toISOString(), products },
        products: index.products || [],
        seriesById,
      };
    });
    return fallbackStatePromise;
  }

  async function buildSeriesData(seriesId) {
    if (seriesDataPromises.has(seriesId)) return seriesDataPromises.get(seriesId);
    const promise = loadFallbackState().then(async (state) => {
      const series = state.seriesById.get(seriesId);
      if (!series) throw new Error(`unknown series ${seriesId}`);

      const grouped = new Map();
      for (const product of state.products) {
        const canonicalTitle = findCanonicalTitle(product.title, series);
        if (!canonicalTitle) continue;
        const bucket = grouped.get(canonicalTitle) || [];
        bucket.push(product);
        grouped.set(canonicalTitle, bucket);
      }

      const selected = series.titles.flatMap((title) => {
        const matches = grouped.get(title) || [];
        if (!matches.length) return [];
        const normal = matches.filter(isNormalConditionProduct);
        return (normal.length ? normal : matches)
          .slice()
          .sort((left, right) =>
            displayProductTitle(left.title).localeCompare(displayProductTitle(right.title), 'ja-JP') || left.id - right.id,
          );
      });

      const lines = (await Promise.all(selected.map(async (product) => {
        if (product.historyCount === 0) return null;
        try {
          const detail = await json(`./data/products/${product.id}.json`);
          const histories = (detail.histories || []).map((history) => ({
            checkedAt: history.checkedAt,
            salePrice: history.salePrice,
          }));
          if (!histories.some((history) => history.salePrice != null)) return null;
          return {
            productId: product.id,
            title: displayProductTitle(product.title),
            modelNumber: detail.product?.modelNumber ?? null,
            releaseDate: detail.product?.releaseDate ?? product.releaseDate ?? null,
            histories,
          };
        } catch {
          return null;
        }
      }))).filter(Boolean);

      return {
        id: series.id,
        name: series.name,
        definedTitleCount: series.titles.length,
        lines,
      };
    });
    seriesDataPromises.set(seriesId, promise);
    return promise;
  }

  function jsonResponse(value) {
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  globalThis.fetch = async (input, init) => {
    const url = requestUrl(input);
    const indexRequest = SERIES_INDEX_PATTERN.test(url);
    const seriesMatch = SERIES_DATA_PATTERN.exec(url);
    if (!indexRequest && !seriesMatch) return nativeFetch(input, init);

    const original = await nativeFetch(input, init);
    if (original.ok || original.status !== 404) return original;

    try {
      if (indexRequest) {
        const state = await loadFallbackState();
        return jsonResponse(state.index);
      }
      const seriesId = decodeURIComponent(seriesMatch[1]);
      return jsonResponse(await buildSeriesData(seriesId));
    } catch (error) {
      console.error('Viewerシリーズ価格データの補完に失敗しました。', error);
      return original;
    }
  };
})();
