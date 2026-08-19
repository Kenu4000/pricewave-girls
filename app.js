const app = document.querySelector('#app');
const generatedAtEl = document.querySelector('#generated-at');
const saleCountdownEl = document.querySelector('#sale-countdown');
const state = { data: null, page: 1, perPage: 24, query: '', brand: '', sort: 'updated_desc' };
const yen = (value) => value == null ? '未取得' : `${Number(value).toLocaleString('ja-JP')}円`;
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dateTime = (value) => value ? new Date(value).toLocaleString('ja-JP') : '未取得';
const dateOnly = (value) => value ? new Date(value).toLocaleDateString('ja-JP') : '変更なし';
const relDay = (value) => {
  if (!value) return '';
  const now = new Date(); const d = new Date(value);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const n = Math.max(0, Math.round((a-b)/86400000));
  return n === 0 ? '今日' : n === 1 ? '昨日' : `${n}日前`;
};
function deltaLabel(change, kind) {
  if (!change || change.previousPrice == null || change.currentPrice == null) return '';
  const diff = change.currentPrice - change.previousPrice;
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  const sign = diff > 0 ? '+' : '';
  return `${kind}${arrow}${sign}${diff.toLocaleString('ja-JP')}円・${relDay(change.changedAt)}`;
}
function saleClass(change) {
  if (!change || change.previousPrice == null || change.currentPrice == null) return '';
  return change.currentPrice > change.previousPrice ? 'sale-up' : change.currentPrice < change.previousPrice ? 'sale-down' : '';
}
function buyClass(change) {
  if (!change || change.previousPrice == null || change.currentPrice == null) return '';
  return change.currentPrice > change.previousPrice ? 'buy-up' : change.currentPrice < change.previousPrice ? 'buy-down' : '';
}
function stockLabel(value) { return value === 'out_of_stock' ? '在庫なし' : value === 'unknown' || value == null ? '在庫不明' : ''; }
function addViewed(id) {
  const key = 'pricewave:pages-viewed';
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  ids = [id, ...ids.filter((x) => x !== id)].slice(0, 40);
  localStorage.setItem(key, JSON.stringify(ids));
}
function viewedIds() {
  try { return JSON.parse(localStorage.getItem('pricewave:pages-viewed') || '[]').filter(Number.isInteger).slice(0,40); } catch { return []; }
}
function activeSaleProduct() {
  const now = Date.now();
  return state.data?.products
    ?.filter((p) => p.isTimeSale && p.timeSaleEndsAt && new Date(p.timeSaleEndsAt).getTime() > now)
    .sort((a,b) => new Date(a.timeSaleEndsAt)-new Date(b.timeSaleEndsAt))[0] || null;
}
function updateCountdown() {
  const product = activeSaleProduct();
  if (!product) { saleCountdownEl.hidden = true; return; }
  const end = new Date(product.timeSaleEndsAt); const ms = end - Date.now();
  if (ms <= 0) { saleCountdownEl.hidden = true; return; }
  const sec = Math.floor(ms/1000); const h = Math.floor(sec/3600); const m = Math.floor(sec%3600/60); const s = sec%60;
  saleCountdownEl.textContent = `タイムセール終了まで ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}　${end.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
  saleCountdownEl.hidden = false;
}
function filteredProducts(source = state.data.products) {
  const q = state.query.trim().toLocaleLowerCase('ja');
  let items = source.filter((p) => (!q || p.title.toLocaleLowerCase('ja').includes(q)) && (!state.brand || p.manufacturer === state.brand));
  const sorters = {
    updated_desc:(a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)||b.id-a.id,
    updated_asc:(a,b)=>new Date(a.updatedAt)-new Date(b.updatedAt)||a.id-b.id,
    sale_asc:(a,b)=>(a.latestSalePrice??Infinity)-(b.latestSalePrice??Infinity),
    sale_desc:(a,b)=>(b.latestSalePrice??-1)-(a.latestSalePrice??-1),
    release_desc:(a,b)=>String(b.releaseDate||'').localeCompare(String(a.releaseDate||'')),
    title_asc:(a,b)=>a.title.localeCompare(b.title,'ja'),
  };
  return items.sort(sorters[state.sort] || sorters.updated_desc);
}
function productCard(p) {
  const saleChange = p.isTimeSale ? null : p.latestChanges?.sale;
  const buyChange = p.latestChanges?.buy;
  const timeSale = p.isTimeSale && p.latestRegularSalePrice != null && p.latestSalePrice != null && p.latestRegularSalePrice !== p.latestSalePrice;
  const saleDiff = timeSale ? p.latestSalePrice - p.latestRegularSalePrice : 0;
  const tags = [];
  if (timeSale) tags.push(`<span class="tag time-sale">タイムセール↓${saleDiff.toLocaleString('ja-JP')}円・${relDay(p.timeSaleStartedAt)}</span>`);
  else if (saleChange) tags.push(`<span class="tag ${saleChange.currentPrice > saleChange.previousPrice ? 'up':'down'}">${esc(deltaLabel(saleChange,'売価'))}</span>`);
  if (buyChange) tags.push(`<span class="tag ${buyChange.currentPrice > buyChange.previousPrice ? 'up':'down'}">${esc(deltaLabel(buyChange,'買取'))}</span>`);
  const condition = p.conditionRank === 'B' || p.condition ? `<span class="badge">状態: ランクB${p.condition ? `（${esc(p.condition)}）`:''}</span>` : '';
  const stock = stockLabel(p.stockStatus);
  return `<a class="product-card ${timeSale?'time-sale':saleClass(saleChange)} ${buyClass(buyChange)}" href="#/products/${p.id}">
    <div class="product-image">${p.imageUrl ? `<img loading="lazy" src="${esc(p.imageUrl)}" alt="${esc(p.title)}">` : '<span class="muted">No Image</span>'}</div>
    <div class="product-title">${esc(p.title)}</div>
    ${tags.length ? `<div class="tags">${tags.join('')}</div>`:''}
    <div class="price-row"><span class="badge">販売: ${yen(p.latestSalePrice)}</span><span class="badge">買取: ${yen(p.latestBuyPrice)}</span>${stock?`<span class="badge">${stock}</span>`:''}${condition}${timeSale?`<span class="badge">通常価格: ${yen(p.latestRegularSalePrice)}</span>`:''}</div>
    <dl class="facts">${p.manufacturer?`<div><dt>ブランド</dt><dd>${esc(p.manufacturer)}</dd></div>`:''}${p.releaseDate?`<div><dt>発売日</dt><dd>${esc(p.releaseDate.replaceAll('-','/'))}</dd></div>`:''}<div><dt>更新</dt><dd>${esc(dateTime(p.updatedAt))}</dd></div></dl>
  </a>`;
}
function pager(total) {
  const pages = Math.max(1, Math.ceil(total/state.perPage)); state.page = Math.min(state.page,pages);
  return `<div class="pager"><button data-page="${state.page-1}" ${state.page<=1?'disabled':''}>前へ</button><span class="button">${state.page} / ${pages}</span><button data-page="${state.page+1}" ${state.page>=pages?'disabled':''}>次へ</button></div>`;
}
function renderProducts(customProducts = null, title = '商品一覧') {
  const brands = [...new Set(state.data.products.map((p)=>p.manufacturer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
  const items = customProducts || filteredProducts(); const start=(state.page-1)*state.perPage; const visible=items.slice(start,start+state.perPage);
  app.innerHTML = `<div class="section-title"><h1>${esc(title)}</h1><span class="muted">${items.length.toLocaleString('ja-JP')}件</span></div>
  ${customProducts ? '' : `<div class="toolbar panel"><input class="search" id="q" value="${esc(state.query)}" placeholder="商品名で検索"><select id="brand"><option value="">全ブランド</option>${brands.map((b)=>`<option ${b===state.brand?'selected':''}>${esc(b)}</option>`).join('')}</select><select id="sort"><option value="updated_desc" ${state.sort==='updated_desc'?'selected':''}>更新が新しい順</option><option value="updated_asc" ${state.sort==='updated_asc'?'selected':''}>更新が古い順</option><option value="sale_asc" ${state.sort==='sale_asc'?'selected':''}>販売価格が安い順</option><option value="sale_desc" ${state.sort==='sale_desc'?'selected':''}>販売価格が高い順</option><option value="release_desc" ${state.sort==='release_desc'?'selected':''}>発売日が新しい順</option><option value="title_asc" ${state.sort==='title_asc'?'selected':''}>商品名順</option></select><select id="per"><option ${state.perPage===24?'selected':''}>24</option><option ${state.perPage===48?'selected':''}>48</option><option ${state.perPage===96?'selected':''}>96</option></select></div>`}
  ${visible.length?`<div class="grid">${visible.map(productCard).join('')}</div>${pager(items.length)}`:'<div class="panel empty">条件に一致する商品がありません。</div>'}`;
  if (!customProducts) {
    document.querySelector('#q').addEventListener('input',(e)=>{state.query=e.target.value;state.page=1;renderProducts();});
    document.querySelector('#brand').addEventListener('change',(e)=>{state.brand=e.target.value;state.page=1;renderProducts();});
    document.querySelector('#sort').addEventListener('change',(e)=>{state.sort=e.target.value;state.page=1;renderProducts();});
    document.querySelector('#per').addEventListener('change',(e)=>{state.perPage=Number(e.target.value);state.page=1;renderProducts();});
  }
  document.querySelectorAll('[data-page]').forEach((b)=>b.addEventListener('click',()=>{state.page=Number(b.dataset.page);renderProducts(customProducts,title);scrollTo({top:0,behavior:'smooth'});}));
}
function renderChanges() {
  const changes = state.data.priceChanges;
  app.innerHTML = `<div class="section-title"><h1>価格変更</h1><span class="muted">${changes.length.toLocaleString('ja-JP')}件</span></div><div class="viewer-note">タイムセールと未取得が関わる変更は含めていません。</div><div class="change-list">${changes.map((c)=>{const diff=c.currentPrice-c.previousPrice;return `<article class="change-card"><time>${esc(dateTime(c.changedAt))}</time><div class="change-product">${c.product.imageUrl?`<img loading="lazy" src="${esc(c.product.imageUrl)}" alt="">`:''}<a href="#/products/${c.productId}">${esc(c.product.title)}</a></div><span>${c.type==='sale'?'販売':'買取'}</span><span>${yen(c.previousPrice)} → ${yen(c.currentPrice)} <b class="delta ${diff>0?'up':'down'}">${diff>0?'+':''}${diff.toLocaleString('ja-JP')}円</b></span></article>`}).join('') || '<div class="panel empty">価格変更はありません。</div>'}</div>`;
}
function filterHistoryRows(histories) {
  const desc=[...histories].sort((a,b)=>new Date(b.checkedAt)-new Date(a.checkedAt)); if(desc.length<=10)return desc;
  const keep=desc.slice(0,10); let newer=desc[9];
  for(const row of desc.slice(10)){const changed=row.salePrice!==newer.salePrice||row.regularSalePrice!==newer.regularSalePrice||row.buyPrice!==newer.buyPrice;if(changed)keep.push(row);newer=row;}
  return keep;
}
function graphSeries(histories) {
  return [...histories].sort((a,b)=>new Date(a.checkedAt)-new Date(b.checkedAt)).map((h)=>({
    t:new Date(h.checkedAt).getTime(), checkedAt:h.checkedAt,
    sale:h.conditionRank==='B'?null:(h.isTimeSale&&h.regularSalePrice!=null?h.regularSalePrice:h.salePrice),
    buy:h.buyPrice,
    rankb:h.conditionRank==='B'?(h.isTimeSale&&h.regularSalePrice!=null?h.regularSalePrice:h.salePrice):null,
    timesale:h.isTimeSale?h.salePrice:null
  }));
}
function renderChart(histories) {
  const data=graphSeries(histories); if(!data.length)return '<div class="panel empty">価格履歴がありません。</div>';
  const values=data.flatMap((d)=>[d.sale,d.buy,d.rankb,d.timesale]).filter((v)=>v!=null); if(!values.length)return '<div class="panel empty">価格データがありません。</div>';
  const W=1000,H=320,P=45,minT=Math.min(...data.map(d=>d.t)),maxT=Math.max(...data.map(d=>d.t)); const minV=Math.min(...values),maxV=Math.max(...values); const pad=Math.max(100,(maxV-minV)*.08); const lo=Math.max(0,minV-pad),hi=maxV+pad;
  const x=(t)=>P+(maxT===minT?(W-2*P)/2:(t-minT)/(maxT-minT)*(W-2*P)); const y=(v)=>H-P-(v-lo)/(hi-lo||1)*(H-2*P);
  const pathFor=(key)=>{let out='',open=false;for(const d of data){const v=d[key];if(v==null){open=false;continue;}out+=`${open?'L':'M'}${x(d.t).toFixed(1)},${y(v).toFixed(1)} `;open=true;}return out;};
  const dots=(key,cls)=>data.filter(d=>d[key]!=null).map(d=>`<circle class="chart-dot" data-price="${d[key]}" data-date="${esc(d.checkedAt)}" cx="${x(d.t)}" cy="${y(d[key])}" r="4" fill="currentColor"></circle>`).join('');
  const grid=[0,.25,.5,.75,1].map(r=>{const yy=P+r*(H-2*P);const val=Math.round(hi-r*(hi-lo));return `<line class="gridline" x1="${P}" x2="${W-P}" y1="${yy}" y2="${yy}"></line><text x="4" y="${yy+4}">${val.toLocaleString('ja-JP')}</text>`}).join('');
  return `<div class="legend"><span class="sale">販売</span><span class="buy">買取</span><span class="rankb">ランクB</span><span class="timesale">タイムセール</span></div><div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<g class="sale"><path d="${pathFor('sale')}"></path>${dots('sale','sale')}</g><g class="buy"><path d="${pathFor('buy')}"></path>${dots('buy','buy')}</g><g class="rankb"><path d="${pathFor('rankb')}"></path>${dots('rankb','rankb')}</g><g class="timesale"><path d="${pathFor('timesale')}"></path>${dots('timesale','timesale')}</g></svg></div>`;
}
function bindChartTooltips() {
  let tip=document.querySelector('.chart-tooltip'); if(!tip){tip=document.createElement('div');tip.className='chart-tooltip';tip.hidden=true;document.body.appendChild(tip);}
  document.querySelectorAll('.chart-dot').forEach((dot)=>{
    dot.addEventListener('pointerenter',(e)=>{tip.textContent=`${yen(Number(dot.dataset.price))} / ${dateTime(dot.dataset.date)}`;tip.hidden=false;moveTip(e,dot);});
    dot.addEventListener('pointermove',(e)=>moveTip(e,dot)); dot.addEventListener('pointerleave',()=>tip.hidden=true);
  });
  function moveTip(e,dot){const rect=dot.getBoundingClientRect();const viewportHalf=innerHeight/2;const above=rect.top>viewportHalf;tip.style.left=`${Math.min(innerWidth-190,Math.max(8,e.clientX+10))}px`;tip.style.top=`${Math.max(8,e.clientY+(above?-38:16))}px`;}
}
async function renderProduct(id) {
  app.innerHTML='<div class="panel loading">商品データを読み込んでいます…</div>';
  try {
    const detail=await fetch(`./data/products/${id}.json`,{cache:'no-store'}).then((r)=>{if(!r.ok)throw new Error();return r.json();}); const p=detail.product;addViewed(p.id);
    const rows=filterHistoryRows(detail.histories);
    const details=Object.entries(p.details||{}).filter(([k])=>!k.startsWith('__pricewave_'));
    app.innerHTML=`<a class="button" href="#/products">← 商品一覧</a><section class="panel block"><div class="detail-head"><div class="detail-image">${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt="${esc(p.title)}">`:'<span class="muted">No Image</span>'}</div><div><h1 class="detail-title">${esc(p.title)}</h1><div class="detail-prices"><span class="badge">販売 ${yen(p.latestSalePrice)}</span><span class="badge">買取 ${yen(p.latestBuyPrice)}</span>${p.isTimeSale&&p.latestRegularSalePrice!=null?`<span class="badge">通常 ${yen(p.latestRegularSalePrice)}</span>`:''}</div><dl class="facts">${p.manufacturer?`<div><dt>ブランド</dt><dd>${esc(p.manufacturer)}</dd></div>`:''}${p.releaseDate?`<div><dt>発売日</dt><dd>${esc(p.releaseDate)}</dd></div>`:''}${p.listPrice!=null?`<div><dt>定価</dt><dd>${yen(p.listPrice)}</dd></div>`:''}<div><dt>最終取得</dt><dd>${esc(dateTime(p.updatedAt))}</dd></div></dl><div class="detail-actions"><a class="button" href="${esc(p.surugayaUrl)}" target="_blank" rel="noreferrer">駿河屋で開く</a></div></div></div></section>
    <section class="panel block"><div class="section-title"><h2>価格推移</h2><span class="muted">全${detail.histories.length}取得点</span></div>${renderChart(detail.histories)}</section>
    <section class="panel block"><div class="section-title"><h2>価格履歴</h2><span class="muted">直近10件＋過去の異なる価格</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>取得日時</th><th>販売</th><th>通常価格</th><th>買取</th><th>状態</th></tr></thead><tbody>${rows.map((h)=>`<tr><td>${esc(dateTime(h.checkedAt))}</td><td>${yen(h.salePrice)}</td><td>${h.regularSalePrice==null?'—':yen(h.regularSalePrice)}</td><td>${yen(h.buyPrice)}</td><td>${h.isTimeSale?'タイムセール':h.conditionRank==='B'?`ランクB${h.condition?`（${esc(h.condition)}）`:''}`:'通常'}</td></tr>`).join('')}</tbody></table></div></section>
    ${detail.junkHistories.length?`<section class="panel block"><div class="section-title"><h2>ジャンク・他ショップ履歴</h2><span class="muted">${detail.junkHistories.length}件</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>取得日時</th><th>店舗</th><th>状態</th><th>価格</th></tr></thead><tbody>${detail.junkHistories.map((h)=>`<tr><td>${esc(dateTime(h.checkedAt))}</td><td>${esc(h.storeName||'駿河屋')}</td><td>${esc(h.condition)}</td><td>${yen(h.price)}</td></tr>`).join('')}</tbody></table></div></section>`:''}
    ${details.length?`<section class="panel block"><h2>駿河屋の商品詳細情報</h2><dl class="details-list">${details.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`:''}`;
    bindChartTooltips();
  } catch { app.innerHTML='<div class="panel empty">商品データを読み込めませんでした。</div>'; }
}
function renderHistory() {
  const ids=viewedIds();const map=new Map(state.data.products.map((p)=>[p.id,p]));const products=ids.map((id)=>map.get(id)).filter(Boolean);state.page=1;renderProducts(products,'閲覧履歴');
}
function route() {
  const hash=location.hash||'#/products'; const match=hash.match(/^#\/products\/(\d+)/);
  if(match){renderProduct(Number(match[1]));return;} if(hash.startsWith('#/changes')){renderChanges();return;} if(hash.startsWith('#/history')){renderHistory();return;} state.page=1;renderProducts();
}
fetch('./data/index.json',{cache:'no-store'}).then((r)=>{if(!r.ok)throw new Error();return r.json();}).then((data)=>{state.data=data;generatedAtEl.textContent=`データ更新: ${dateTime(data.generatedAt)}`;updateCountdown();setInterval(updateCountdown,1000);route();window.addEventListener('hashchange',route);}).catch(()=>{app.innerHTML='<div class="panel empty">閲覧用データがありません。メインPCで viewer:publish を実行してください。</div>';});
