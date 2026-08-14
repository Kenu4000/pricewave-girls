(() => {
  const SURUGAYA_LOGO = 'https://www.suruga-ya.jp/pics_webp/common/pc/logo-surugaya.svg.webp';
  const SURUGAYA_USER_ICON = 'https://www.suruga-ya.jp/pics_webp/common/pc/user_black.svg.webp';
  const SURUGAYA_CART_ICON = 'https://www.suruga-ya.jp/pics_webp/common/pc/cart_black.svg.webp';
  const SURUGAYA_CART_BUTTON = 'https://www.suruga-ya.jp/database/images/cart.jpg';

  function fauxTitle() {
    const heading = app.querySelector('.detail-main h1, .product-detail h1, h1');
    return heading?.textContent?.trim() || '商品';
  }

  function conditionGroup(condition) {
    const value = String(condition || '').normalize('NFKC');
    if (value.includes('新品')) return 'new';
    if (value.includes('予約')) return 'reservation';
    if (value.includes('プレミア')) return 'premium';
    if (value.includes('ワケアリ')) return 'wakeari';
    return 'used';
  }

  function conditionLabel(condition) {
    const value = String(condition || '').trim();
    if (!value) return '中古';
    if (/^(?:中古|新品|予約|プレミア|ワケアリ)/u.test(value)) return value;
    return `中古 ${value}`;
  }

  function priceRange(items) {
    const values = items.map((item) => Number(item.price)).filter((value) => Number.isFinite(value));
    if (!values.length) return '価格未取得';
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? yen(min) : `${yen(min)} ～ ${yen(max)}`;
  }

  function counts(items) {
    const result = { all: items.length, new: 0, used: 0, reservation: 0, premium: 0, wakeari: 0 };
    for (const item of items) result[conditionGroup(item.condition)] += 1;
    return result;
  }

  function proxyAttrs(href) {
    return `data-suru-faux-link="${href}" role="link" tabindex="0"`;
  }

  function fakeHeader(href) {
    const proxy = proxyAttrs(href);
    return `
      <div class="suru-faux-pc-header">
        <div class="suru-faux-pc-top">
          <span class="suru-faux-menu" ${proxy} aria-label="駿河屋でメニューを開く"><i></i><i></i><i></i></span>
          <img class="suru-faux-logo" ${proxy} src="${SURUGAYA_LOGO}" alt="駿河屋">
          <div class="suru-faux-search" ${proxy}><span>全商品</span><input aria-label="検索" readonly><button type="button" tabindex="-1">検索</button></div>
          <span class="suru-faux-safe" ${proxy}>セーフサーチ OFF</span>
          <span class="suru-faux-account" ${proxy}>サインイン <img src="${SURUGAYA_USER_ICON}" alt=""></span>
          <span class="suru-faux-cart" ${proxy}><img src="${SURUGAYA_CART_ICON}" alt="">0</span>
        </div>
        <div class="suru-faux-pc-sub"><span ${proxy}>キャンペーン</span><span ${proxy}>新入荷</span><span ${proxy}>予約</span><span ${proxy}>特集</span><span ${proxy}>売りたい</span><span class="suru-faux-sub-spacer"></span><span ${proxy}>お気に入り</span><span ${proxy}>閲覧履歴</span></div>
      </div>
      <div class="suru-faux-sp-header">
        <div class="suru-faux-sp-top">
          <span class="suru-faux-menu" ${proxy} aria-label="駿河屋でメニューを開く"><i></i><i></i><i></i></span>
          <img class="suru-faux-logo" ${proxy} src="${SURUGAYA_LOGO}" alt="駿河屋">
          <img class="suru-faux-sp-icon" ${proxy} src="${SURUGAYA_USER_ICON}" alt="サインイン">
          <span class="suru-faux-sp-cart" ${proxy}><img class="suru-faux-sp-icon" src="${SURUGAYA_CART_ICON}" alt="カート"><b>0</b></span>
        </div>
        <div class="suru-faux-sp-search" ${proxy}><span>⌕</span><input value="" placeholder="商品を検索する" readonly><button type="button" tabindex="-1">検索</button></div>
        <div class="suru-faux-sp-safe" ${proxy}>セーフサーチ 未設定</div>
        <div class="suru-faux-sp-nav"><span ${proxy}>● キャンペーン</span><span ${proxy}>● 新入荷</span><span ${proxy}>● 予約</span><span ${proxy}>● 特集</span></div>
      </div>`;
  }

  function tabs(items, href) {
    const c = counts(items);
    const proxy = proxyAttrs(href);
    return `<div class="suru-faux-tabs" aria-label="商品状態タブ">
      <span class="active" ${proxy}>全て(<b>${c.all}</b>)</span>
      <span ${proxy}>新品(<b>${c.new}</b>)</span>
      <span ${proxy}>中古(<b>${c.used}</b>)</span>
      <span ${proxy}>予約(<b>${c.reservation}</b>)</span>
      <span ${proxy}>プレミア(<b>${c.premium}</b>)</span>
      <span ${proxy}>ワケアリ(<b>${c.wakeari}</b>)</span>
    </div>`;
  }

  function row(item, otherShopUrl) {
    const href = otherShopUrl ? esc(otherShopUrl) : '#';
    return `<article class="suru-faux-row">
      <div class="suru-faux-row-price"><strong>${yen(item.price)}</strong></div>
      <div class="suru-faux-row-condition"><a href="${href}" target="_blank" rel="noreferrer">${esc(conditionLabel(item.condition))}</a></div>
      <div class="suru-faux-row-store"><a href="${href}" target="_blank" rel="noreferrer"><strong>${esc(item.storeName || '店舗名不明')}</strong></a><div class="suru-faux-stars" aria-hidden="true">★★★★★</div></div>
      <div class="suru-faux-row-shipping"><span>店頭でも購入できます。</span><a href="${href}" target="_blank" rel="noreferrer">配送料</a> および <a href="${href}" target="_blank" rel="noreferrer">返品について。</a></div>
      <div class="suru-faux-row-action"><a href="${href}" target="_blank" rel="noreferrer"><img src="${SURUGAYA_CART_BUTTON}" alt="カートに入れる"></a><a href="${href}" target="_blank" rel="noreferrer">${esc(item.storeName || '店舗')}の出品を見る</a></div>
    </article>`;
  }

  function fauxProxyTarget(event) {
    const origin = event.target;
    if (!(origin instanceof Element)) return null;
    if (origin.closest('.suru-faux-frame a[href]')) return null;
    return origin.closest('[data-suru-faux-link]');
  }

  function openFauxProxy(event) {
    const target = fauxProxyTarget(event);
    if (!target) return;
    const href = target.getAttribute('data-suru-faux-link');
    if (!href || href === '#') return;
    event.preventDefault();
    event.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  document.addEventListener('click', openFauxProxy, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    openFauxProxy(event);
  }, true);

  viewerCurrentOfferList = function viewerCurrentOfferListAsSurugaya(items, otherShopUrl) {
    const href = otherShopUrl ? esc(otherShopUrl) : '#';
    if (!items.length) {
      return `<div class="suru-faux-frame">${fakeHeader(href)}<div class="suru-faux-page"><p class="suru-faux-soldout">申し訳ございません。品切れ中です。</p></div></div>`;
    }

    const title = fauxTitle();
    return `<div class="suru-faux-frame">
      ${fakeHeader(href)}
      <div class="suru-faux-page">
        <div class="suru-faux-breadcrumb"><a href="${href}" target="_blank" rel="noreferrer">駿河屋TOP</a> ≫ パソコン・スマホ ≫ パソコンソフト</div>
        <section class="suru-faux-product">
          <div class="suru-faux-product-placeholder">商品画像</div>
          <div class="suru-faux-product-copy">
            <h4>${esc(title)}の取り扱い店舗一覧</h4>
            <p class="suru-faux-product-category">Windows　PCソフト</p>
            <p class="suru-faux-product-price">価格： <strong>${priceRange(items)}</strong></p>
            <a href="${href}" target="_blank" rel="noreferrer">＞商品詳細はこちら</a>
          </div>
        </section>
        ${tabs(items, href)}
        <div class="suru-faux-table">
          <div class="suru-faux-table-head"><span ${proxyAttrs(href)}><select tabindex="-1" aria-hidden="true"><option>価格が安い順</option></select></span><span>コンディション</span><span>販売</span><span>配送</span><span>購入オプション</span></div>
          ${items.map((item) => row(item, otherShopUrl)).join('')}
        </div>
      </div>
    </div>`;
  };
})();
