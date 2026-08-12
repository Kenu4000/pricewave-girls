const desktopRenderChart = renderChart;
const desktopBindChartTooltips = bindChartTooltips;

let mobileChartRange = 'week';
let mobileChartSourceHistories = [];

function mobileChartPriceLabel(value) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000) {
    return `${Number((rounded / 1000).toFixed(1))}k`;
  }
  return rounded.toLocaleString('ja-JP');
}

function mobileChartDateLabel(timestamp, includeYear = false) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('ja-JP', includeYear
    ? { year: '2-digit', month: 'numeric', day: 'numeric' }
    : { month: 'numeric', day: 'numeric' });
}

function localDayKey(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
}

function mobileChartDailyHistories(histories) {
  const latestByDay = new Map();
  const sorted = [...histories].sort((left, right) => new Date(left.checkedAt) - new Date(right.checkedAt));
  for (const history of sorted) {
    const key = localDayKey(history.checkedAt);
    if (key) latestByDay.set(key, history);
  }
  return [...latestByDay.values()];
}

function mobileChartData(histories, range) {
  const dailyData = graphSeries(mobileChartDailyHistories(histories));
  if (range === 'week') return dailyData.slice(-7);
  if (range === 'month' && dailyData.length) {
    const latest = dailyData[dailyData.length - 1].t;
    const date = new Date(latest);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 29).getTime();
    const end = endOfLocalDay(latest);
    return dailyData.filter((point) => point.t >= start && point.t <= end);
  }
  return dailyData;
}

function mobileChartRangeButtons() {
  return `<div class="mobile-chart-range" role="group" aria-label="グラフ表示期間">
    <button type="button" data-mobile-chart-range="week" ${mobileChartRange === 'week' ? 'aria-pressed="true"' : 'aria-pressed="false"'}>7日</button>
    <button type="button" data-mobile-chart-range="month" ${mobileChartRange === 'month' ? 'aria-pressed="true"' : 'aria-pressed="false"'}>1か月</button>
    <button type="button" data-mobile-chart-range="all" ${mobileChartRange === 'all' ? 'aria-pressed="true"' : 'aria-pressed="false"'}>全期間</button>
  </div>`;
}

renderChart = function renderResponsiveChart(histories) {
  if (!matchMedia('(max-width: 760px)').matches) {
    return desktopRenderChart(histories);
  }

  mobileChartSourceHistories = histories;
  const data = mobileChartData(histories, mobileChartRange);
  if (!data.length) return '<div class="panel empty">価格履歴がありません。</div>';

  const values = data.flatMap((point) => [point.sale, point.buy, point.rankb, point.timesale]).filter((value) => value != null);
  if (!values.length) return '<div class="panel empty">価格データがありません。</div>';

  const W = 720;
  const H = 360;
  const LEFT = 70;
  const RIGHT = 18;
  const TOP = 20;
  const BOTTOM = 72;
  const minT = data[0].t;
  const maxT = data[data.length - 1].t;
  const maxV = Math.max(...values);
  const lo = 0;
  const hi = Math.max(100, maxV + Math.max(80, maxV * 0.08));
  const plotWidth = W - LEFT - RIGHT;
  const plotHeight = H - TOP - BOTTOM;

  const xByTime = (timestamp) => LEFT + (maxT === minT ? plotWidth / 2 : ((timestamp - minT) / (maxT - minT)) * plotWidth);
  const xByIndex = (index) => LEFT + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const x = (point, index) => mobileChartRange === 'week' ? xByIndex(index) : xByTime(point.t);
  const y = (value) => TOP + ((hi - value) / (hi - lo || 1)) * plotHeight;

  const pathFor = (key) => {
    let out = '';
    let open = false;
    data.forEach((point, index) => {
      const value = point[key];
      if (value == null) {
        open = false;
        return;
      }
      out += `${open ? 'L' : 'M'}${x(point, index).toFixed(1)},${y(value).toFixed(1)} `;
      open = true;
    });
    return out;
  };

  const dots = (key) => data
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point[key] != null)
    .map(({ point, index }) => {
      const cx = x(point, index);
      const cy = y(point[key]);
      const attrs = `data-price="${point[key]}" data-date="${esc(point.checkedAt)}" cx="${cx}" cy="${cy}"`;
      return `<circle class="chart-point" ${attrs} r="5.5"></circle><circle class="chart-hit" ${attrs} r="36"></circle>`;
    })
    .join('');

  const yTicks = [0, 0.5, 1].map((ratio) => {
    const yy = TOP + ratio * plotHeight;
    const value = Math.round(hi - ratio * hi);
    return `<line class="gridline" x1="${LEFT}" x2="${W - RIGHT}" y1="${yy}" y2="${yy}"></line><text class="chart-y-label" x="${LEFT - 10}" y="${yy + 6}" text-anchor="end">${mobileChartPriceLabel(value)}</text>`;
  }).join('');

  const includeYear = new Date(minT).getFullYear() !== new Date(maxT).getFullYear();
  let xLabels = '';
  if (mobileChartRange === 'week') {
    xLabels = data.map((point, index) => {
      const xx = x(point, index);
      const anchor = index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle';
      return `<line class="chart-x-tick" x1="${xx}" x2="${xx}" y1="${H - BOTTOM}" y2="${H - BOTTOM + 8}"></line><text class="chart-x-label" x="${xx}" y="${H - 24}" text-anchor="${anchor}">${mobileChartDateLabel(point.t, includeYear)}</text>`;
    }).join('');
  } else {
    const count = mobileChartRange === 'month' ? 5 : 3;
    const tickTimes = maxT <= minT
      ? [minT]
      : Array.from({ length: count }, (_, index) => minT + ((maxT - minT) * index) / (count - 1));
    xLabels = tickTimes.map((timestamp, index) => {
      const xx = xByTime(timestamp);
      const anchor = index === 0 ? 'start' : index === tickTimes.length - 1 ? 'end' : 'middle';
      return `<line class="chart-x-tick" x1="${xx}" x2="${xx}" y1="${H - BOTTOM}" y2="${H - BOTTOM + 8}"></line><text class="chart-x-label" x="${xx}" y="${H - 24}" text-anchor="${anchor}">${mobileChartDateLabel(timestamp, includeYear)}</text>`;
    }).join('');
  }

  return `<div class="price-chart-mobile">${mobileChartRangeButtons()}<div class="legend mobile-chart-legend"><span class="sale">販売</span><span class="buy">買取</span><span class="rankb">ランクB</span><span class="timesale">タイムセール</span></div><div class="chart-wrap mobile-chart-wrap"><svg class="chart mobile-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="価格推移グラフ">${yTicks}${xLabels}<g class="sale"><path d="${pathFor('sale')}"></path>${dots('sale')}</g><g class="buy"><path d="${pathFor('buy')}"></path>${dots('buy')}</g><g class="rankb"><path d="${pathFor('rankb')}"></path>${dots('rankb')}</g><g class="timesale"><path d="${pathFor('timesale')}"></path>${dots('timesale')}</g></svg></div><div class="mobile-chart-hint">1日1点（その日の最終確認）・点をタップすると価格を表示</div></div>`;
};

bindChartTooltips = function bindResponsiveChartTooltips() {
  if (!matchMedia('(max-width: 760px)').matches) {
    return desktopBindChartTooltips();
  }

  let tip = document.querySelector('.chart-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    tip.hidden = true;
    document.body.appendChild(tip);
  }

  const showTip = (target) => {
    tip.textContent = `${yen(Number(target.dataset.price))} / ${dateTime(target.dataset.date)}`;
    tip.hidden = false;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const measuredWidth = Math.max(130, tip.getBoundingClientRect().width || 130);
    tip.style.left = `${Math.min(innerWidth - measuredWidth - 8, Math.max(8, centerX - measuredWidth / 2))}px`;
    const above = rect.top - 46;
    tip.style.top = `${above >= 8 ? above : rect.bottom + 10}px`;
  };

  document.querySelectorAll('.chart-hit').forEach((hit) => {
    hit.addEventListener('click', (event) => {
      event.stopPropagation();
      showTip(hit);
    });
    hit.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') showTip(hit);
    });
    hit.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') tip.hidden = true;
    });
  });

  document.querySelector('.mobile-chart')?.addEventListener('click', () => {
    tip.hidden = true;
  });

  document.querySelectorAll('[data-mobile-chart-range]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextRange = button.dataset.mobileChartRange;
      if (!['week', 'month', 'all'].includes(nextRange) || nextRange === mobileChartRange) return;
      mobileChartRange = nextRange;
      tip.hidden = true;
      const chartRoot = document.querySelector('.price-chart-mobile');
      if (!chartRoot) return;
      chartRoot.outerHTML = renderChart(mobileChartSourceHistories);
      bindChartTooltips();
    });
  });
};
