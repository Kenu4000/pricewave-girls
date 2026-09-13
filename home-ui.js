(() => {
  const renderProductSearchPage = globalThis.renderProducts;
  const renderChangePage = globalThis.renderChanges;
  if (typeof renderProductSearchPage !== 'function' || typeof renderChangePage !== 'function') return;

  function isProductSearchRoute() {
    return location.hash.startsWith('#/products?') || location.hash.startsWith('#/search');
  }

  function renderHome() {
    renderChangePage();
    const changeFragment = document.createDocumentFragment();
    for (const node of [...app.childNodes]) changeFragment.append(node);

    renderProductSearchPage(null, '商品検索');
    const searchForm = app.querySelector('#viewer-product-search');
    if (!searchForm) {
      app.replaceChildren(changeFragment);
      return;
    }

    searchForm.addEventListener('submit', () => {
      history.replaceState(null, '', '#/products?search=1');
    }, true);

    const searchSection = document.createElement('section');
    searchSection.className = 'viewer-home-search';
    const heading = document.createElement('div');
    heading.className = 'section-title viewer-home-search-heading';
    heading.innerHTML = '<h2>商品検索</h2>';
    searchSection.append(heading, searchForm);

    app.replaceChildren(searchSection, changeFragment);
  }

  function renderProductsForViewerHome(customProducts = null, title = '商品一覧') {
    if (customProducts) return renderProductSearchPage(customProducts, title);
    if (isProductSearchRoute()) return renderProductSearchPage(null, '検索結果');
    return renderHome();
  }

  globalThis.renderProducts = renderProductsForViewerHome;
  globalThis.renderChanges = renderHome;

  if (!location.hash) history.replaceState(null, '', '#/changes');
  if (state.data) renderHome();
})();