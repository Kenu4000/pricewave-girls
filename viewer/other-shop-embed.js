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

function viewerPastJunkHistories(detail) {
  const items = Array.isArray(detail.junkHistories) ? detail.junkHistories : [];
  const histories = Array.isArray(detail.histories) ? detail.histories : [];
  if (!items.length) return [];

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
  const currentGroup = orderedGroups.find((group) => group.key === currentKey);
  currentGroup?.items.forEach((item) => seen.add(viewerJunkItemIdentity(item)));

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
  return past;
}

function viewerOtherShopSection(detail) {
  const product = detail.product || {};
  const otherShopUrl = viewerOtherShopUrl(product.surugayaUrl);
  const past = viewerPastJunkHistories(detail);
  const live = otherShopUrl
    ? `<div class="other-shop-live-head"><div><h3>販売中</h3><span class="muted">駿河屋の現在一覧</span></div><a class="button" href="${esc(otherShopUrl)}" target="_blank" rel="noreferrer">一覧を別タブで開く</a></div><div class="other-shop-frame-wrap"><iframe class="other-shop-frame" loading="lazy" sandbox="allow-forms allow-popups allow-same-origin allow-scripts" src="${esc(otherShopUrl)}" title="駿河屋の他店舗販売一覧"></iframe></div>`
    : '<p class="muted">他店舗一覧URLを作成できませんでした。</p>';
  const pastTable = past.length
    ? `<div class="other-shop-past-head"><h3>過去データ</h3><span class="muted">${past.length.toLocaleString('ja-JP')}件保存</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>取得日時</th><th>店舗</th><th>状態</th><th>価格</th></tr></thead><tbody>${past.map((history) => `<tr><td>${esc(dateTime(history.checkedAt))}</td><td>${esc(history.storeName || '駿河屋')}</td><td>${esc(history.condition)}</td><td>${yen(history.price)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="other-shop-past-head"><h3>過去データ</h3><span class="muted">0件</span></div><p class="muted">重複を除いた過去データはありません。</p>';

  return `<section class="panel block other-shop-live-section"><div class="section-title"><h2>ジャンク・他ショップ履歴</h2><span class="muted">販売中は駿河屋を直接表示</span></div>${live}<div class="other-shop-past">${pastTable}</div></section>`;
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
    holder.innerHTML = viewerOtherShopSection(detail);
    const replacement = holder.firstElementChild;
    if (!replacement) return;
    if (existing) existing.replaceWith(replacement);
    else if (productDetails) productDetails.before(replacement);
    else app.append(replacement);
  } catch {
    // Viewer本体の表示は維持し、埋め込み補助だけ失敗させる。
  }
}

renderProduct = async function renderProductWithOtherShopEmbed(id) {
  await originalRenderProductForOtherShopEmbed(id);
  await enhanceViewerOtherShopSection(id);
};
