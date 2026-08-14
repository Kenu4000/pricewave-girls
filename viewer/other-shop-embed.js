const originalRenderProductForOtherShopEmbed = renderProduct;

function viewerOtherShopUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!['suruga-ya.jp', 'www.suruga-ya.jp'].includes(parsed.hostname.toLowerCase())) return null;
    const match = parsed.pathname.match(/^\/product\/(?:detail|other)\/([0-9A-Za-z]+)\/?$/);
    return match ? `https://www.suruga-ya.jp/product/other/${match[1]}` : null;
  } catch {
    return null;
  }
}

function viewerJunkItemIdentity(item) {
  const normalize = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/\s+/g, '').trim();
  return [normalize(item.sourceType), normalize(item.storeName), normalize(item.condition), String(item.price)].join('\u0000');
}

function viewerJunkHistorySections(detail) {
  const items = Array.isArray(detail.junkHistories) ? detail.junkHistories : [];
  const histories = Array.isArray(detail.histories) ? detail.histories : [];
  if (!items.length) return { current: [], currentCheckedAt: null, past: [] };

  const latestSnapshotAt = histories.reduce((latest, history) => {
    const time = new Date(history.checkedAt).getTime();
    return Number.isFinite(time) && time > latest ? time : latest;
  }, Number.NEGATIVE_INFINITY);

  const groups = new Map();
  [...items]
    .sort((left, right) => new Date(right.checkedAt) - new Date(left.checkedAt) || Number(right.id || 0) - Number(left.id || 0))
    .forEach((item) => {
      const time = new Date(item.checkedAt).getTime();
      const key = Number.isFinite(time) ? String(Math.floor(time / 1000)) : `invalid-${item.id}`;
      const group = groups.get(key) || { key, checkedAt: item.checkedAt, items: [] };
      group.items.push(item);
      if (new Date(item.checkedAt).getTime() > new Date(group.checkedAt).getTime()) group.checkedAt = item.checkedAt;
      groups.set(key, group);
    });

  const orderedGroups = [...groups.values()].sort((left, right) => new Date(right.checkedAt) - new Date(left.checkedAt));
  let currentKey = null;
  let closestDifference = Number.POSITIVE_INFINITY;
  if (Number.isFinite(latestSnapshotAt)) {
    for (const group of orderedGroups) {
      const difference = Math.abs(new Date(group.checkedAt).getTime() - latestSnapshotAt);
      if (difference < closestDifference) {
        closestDifference = difference;
        currentKey = group.key;
      }
    }
    if (closestDifference > 30_000) currentKey = null;
  }

  const seen = new Set();
  const currentGroup = orderedGroups.find((group) => group.key === currentKey) || null;
  const current = [];
  currentGroup?.items.forEach((item) => {
    const identity = viewerJunkItemIdentity(item);
    if (seen.has(identity)) return;
    seen.add(identity);
    current.push(item);
  });

  const past = [];
  for (const group of orderedGroups) {
    if (group.key === currentKey) continue;
    for (const item of group.items) {
      const identity = viewerJunkItemIdentity(item);
      if (seen.has(identity)) continue;
      seen.add(identity);
      past.push(item);
    }
  }

  return {
    current,
    currentCheckedAt: currentGroup?.checkedAt || null,
    past,
  };
}

function viewerNormalizeOtherShopText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function viewerLegacyOtherShopPrice(value) {
  const text = viewerNormalizeOtherShopText(value).normalize('NFKC');
  const priceZone = text.split(/(?:送料|送料無料|通信販売手数料)/)[0];
  const matches = [...priceZone.matchAll(/(?:[¥￥]\s*([0-9][0-9,\s]*)|([0-9][0-9,\s]*)\s*円)/g)];
  for (const match of matches) {
    const digits = (match[1] || match[2] || '').replace(/[^0-9]/g, '');
    const price = Number(digits);
    if (Number.isInteger(price) && price > 0) return price;
  }
  return null;
}

function viewerLegacyOtherShopStore(element, text) {
  const selectors = [
    '.shop-name',
    '.store-name',
    '.shop_name',
    '.store_name',
    '[class*="shopName"]',
    '[class*="storeName"]',
    'a[href*="/shop/"]',
  ];
  for (const selector of selectors) {
    const value = viewerNormalizeOtherShopText(element.querySelector(selector)?.textContent);
    if (value) return value.replace(/(?:の)?出品を見る.*$/u, '').trim();
  }

  const match = text.match(
    /(?:販売店舗|取扱店舗|店舗名|ショップ)\s*[:：]?\s*([^¥￥0-9]+?)(?=(?:中古|新品|予約|プレミア|ワケアリ|状態|[¥￥]|[0-9]))/u,
  );
  return viewerNormalizeOtherShopText(match?.[1]).replace(/(?:の)?出品を見る.*$/u, '').trim();
}

function viewerLegacyOtherShopCondition(element, text) {
  const selectors = [
    '.condition',
    '.state',
    '.rank',
    '[class*="condition"]',
    '[class*="state"]',
  ];
  for (const selector of selectors) {
    const value = viewerNormalizeOtherShopText(element.querySelector(selector)?.textContent);
    if (value && value.length <= 120 && !/[¥￥]\s*[0-9]/u.test(value)) return value;
  }

  const normalized = text.normalize('NFKC');
  const explicit = normalized.match(/(?:商品状態|状態)\s*[:：]?\s*((?:難あり|中古|新品|予約|プレミア|ワケアリ)[^¥￥0-9]{0,80})/u);
  if (explicit?.[1]) return viewerNormalizeOtherShopText(explicit[1]);
  const standard = normalized.match(/(?:^|\s)((?:中古|新品|予約|プレミア|ワケアリ).*?)(?=\s*(?:[¥￥]\s*[0-9]|[0-9][0-9,\s]*\s*円)|$)/u);
  return viewerNormalizeOtherShopText(standard?.[1]) || '状態不明';
}

function viewerLegacyOtherShopItems(rawHtml) {
  const documentNode = new DOMParser().parseFromString(rawHtml, 'text/html');
  const result = new Map();
  const candidates = documentNode.querySelectorAll('[class*="shop"], [class*="store"], tr, li');

  for (const element of candidates) {
    const text = viewerNormalizeOtherShopText(element.textContent);
    if (!text || !/(?:[¥￥]\s*[0-9０-９]|[0-9０-９][0-9０-９,\s]*\s*円)/u.test(text)) continue;

    const priceElement = element.querySelector('.price, [class*="price"]');
    const price = viewerLegacyOtherShopPrice(priceElement?.textContent || text);
    if (price === null) continue;

    const storeName = viewerLegacyOtherShopStore(element, text);
    if (!storeName || /^(?:店舗|ショップ|駿河屋)$/u.test(storeName)) continue;

    const condition = viewerLegacyOtherShopCondition(element, text);
    const key = [storeName, condition, String(price)]
      .map((value) => viewerNormalizeOtherShopText(value).normalize('NFKC').toLocaleLowerCase('ja-JP'))
      .join('\u0000');
    if (!result.has(key)) result.set(key, { storeName, condition, price });
  }

  return [...result.values()];
}

async function viewerCurrentOtherShopOffers(detail, sections) {
  const snapshot = detail.otherShopSnapshot && typeof detail.otherShopSnapshot === 'object'
    ? detail.otherShopSnapshot
    : null;
  if (Array.isArray(snapshot?.items)) return snapshot.items;

  if (snapshot?.productCode && /^[0-9A-Za-z]+$/.test(snapshot.productCode)) {
    try {
      const response = await fetch(`./data/other-shops/${encodeURIComponent(snapshot.productCode)}.html`, { cache: 'no-store' });
      if (response.ok) {
        const legacyItems = viewerLegacyOtherShopItems(await response.text());
        if (legacyItems.length) return legacyItems;
      }
    } catch {
      // 旧HTMLスナップショットが無い商品はDB由来の現在一覧へフォールバックする。
    }
  }

  return sections.current.filter((item) => item.sourceType === 'other_shop');
}

function viewerCurrentOfferList(items, otherShopUrl) {
  if (!items.length) {
    return '<p class="muted">この取得時点では他店舗の販売データを確認できませんでした。</p>';
  }

  return `<div class="other-shop-list">
    <div class="other-shop-list-head" aria-hidden="true"><span>商品状態</span><span>店舗</span><span>価格</span><span></span></div>
    ${items.map((item) => `<article class="other-shop-offer">
      <div class="other-shop-condition"><span class="other-shop-type">中古商品</span><strong>${esc(item.condition || '状態不明')}</strong></div>
      <div class="other-shop-store"><span class="other-shop-mobile-label">店舗</span><span>${esc(item.storeName || '店舗名不明')}</span></div>
      <div class="other-shop-price"><span class="other-shop-mobile-label">価格</span><strong>${yen(item.price)}</strong><small>税込</small></div>
      ${otherShopUrl ? `<a class="button other-shop-action" href="${esc(otherShopUrl)}" target="_blank" rel="noreferrer">駿河屋で見る</a>` : ''}
    </article>`).join('')}
  </div>`;
}

async function viewerOtherShopSection(detail) {
  const product = detail.product || {};
  const otherShopUrl = viewerOtherShopUrl(product.surugayaUrl);
  const snapshot = detail.otherShopSnapshot && typeof detail.otherShopSnapshot === 'object'
    ? detail.otherShopSnapshot
    : null;
  const sections = viewerJunkHistorySections(detail);
  const currentOffers = await viewerCurrentOtherShopOffers(detail, sections);
  const externalLink = otherShopUrl
    ? `<a class="button" href="${esc(otherShopUrl)}" target="_blank" rel="noreferrer">現在の一覧を駿河屋で開く</a>`
    : '';
  const capturedAt = snapshot?.capturedAt || snapshot?.desktopCapturedAt || sections.currentCheckedAt;
  const status = capturedAt ? `取得 ${esc(dateTime(capturedAt))}` : '保存データなし';
  const live = `<div class="other-shop-live-head"><div><h3>販売中</h3><span class="muted">${status}</span></div>${externalLink}</div>${viewerCurrentOfferList(currentOffers, otherShopUrl)}`;
  const pastTable = sections.past.length
    ? `<div class="other-shop-past-head"><h3>過去データ</h3><span class="muted">${sections.past.length.toLocaleString('ja-JP')}件保存</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>取得日時</th><th>店舗</th><th>状態</th><th>価格</th></tr></thead><tbody>${sections.past.map((history) => `<tr><td>${esc(dateTime(history.checkedAt))}</td><td>${esc(history.storeName || '駿河屋')}</td><td>${esc(history.condition)}</td><td>${yen(history.price)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="other-shop-past-head"><h3>過去データ</h3><span class="muted">0件</span></div><p class="muted">重複を除いた過去データはありません。</p>';

  return `<section class="panel block other-shop-live-section"><div class="section-title"><h2>ジャンク・他ショップ履歴</h2><span class="muted">同じ取得データを画面幅に合わせて表示</span></div>${live}<div class="other-shop-past">${pastTable}</div></section>`;
}

async function enhanceViewerOtherShopSection(id) {
  try {
    const detail = await fetch(`./data/products/${id}.json`, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    });
    const sections = [...app.querySelectorAll('section.panel.block')];
    const existing = sections.find((section) => section.querySelector('h2')?.textContent === 'ジャンク・他ショップ履歴');
    const productDetails = sections.find((section) => section.querySelector('h2')?.textContent === '駿河屋の商品詳細情報');
    const holder = document.createElement('div');
    holder.innerHTML = await viewerOtherShopSection(detail);
    const replacement = holder.firstElementChild;
    if (!replacement) return;
    if (existing) existing.replaceWith(replacement);
    else if (productDetails) productDetails.before(replacement);
    else app.append(replacement);
  } catch {
    // Viewer本体の表示は維持し、他店舗一覧の再構成だけ失敗させる。
  }
}

renderProduct = async function renderProductWithOtherShopEmbed(id) {
  await originalRenderProductForOtherShopEmbed(id);
  await enhanceViewerOtherShopSection(id);
};
