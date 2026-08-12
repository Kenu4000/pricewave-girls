const desktopRenderChart = renderChart;
const desktopBindChartTooltips = bindChartTooltips;

let mobileChartRange = 'week';
let mobileChartSourceHistories = [];

function mobileChartPriceLabel(value) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 10000) {
    const unit = rounded / 10000;
    return `${Number(unit.toFixed(unit < 10 ? 2 : 1))}万`;
  }
  if (Math.abs(rounded) >= 1000) {
    const unit = rounded / 1000;
    return `${Number(unit.toFixed(2))}千`;
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

function startOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
}

function mobileChartWindow(data, range) {
  const latest = data[data.length - 1].t;
  if (range === 'week') {
    const end = endOfLocalDay(latest);
    const date = new Date(latest);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 6).getTime();
    return { start, end };
  }
  if (range === 'month') {
    const end = endOfLocalDay(latest);
    const date = new Date(latest);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 29).getTime();
    return { start, end };
  }
  return {
    start: data[0].t,
    end: data[data.length - 1].t,
  };
}

function mobileChartTickTimes(start, end, range) {
  if (range === 'week') {
    return Array.from({ length: 7 }, (_, index) => startOfLocalDay(start) + index * 86400000);
  }
  const count = range === 'month' ? 5 : 3;
  if (end <= start) return [start];
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

function mobileChartRangeButtons() {
  return `<div class="mobile-chart-range" role="group" aria-label="グラフ表示期間">
    <button type="button" data-mobile-chart-range="week" ${mobileChartRange === 'week' ? 'aria-pressed="true"' : 'aria-pressed="false"'}>1週間</button>
    <button type="button" data-mobile-chart-range="month" ${mobileChartRange === 'month' ? 'aria-pressed="true"' : 'aria-pressed="false"'}>1か月</button>
    <button type="button" data-mobile-chart-range="all" ${mobileChartRange === 'all' ? 'aria-pressed="true"' : 'aria-pressed="false"'}>全期間</button>
  </div>`;
}

renderChart = function renderResponsiveChart(histories) {
  if (!matchMedia('(max-width: 760px)').matches) {
    return desktopRenderChart(histories);
  }

  mobileChartSourceHistories = histories;
  const allData = graphSeries(histories);
  if (!allData.length) return '<div class="panel empty">価格履歴がありません。</div>';

  const windowRange = mobileChartWindow(allData, mobileChartRange);
  const data = allData.filter((point) => point.t >= windowRange.start && point.t <= windowRange.end);
  const values = data.flatMap((point) => [point.sale, point.buy, point.rankb, point.timesale]).filter((value) => value != null);
  if (!values.length) return '<div class="panel empty">価格データがありません。</div>';

  const W = 720;
  const H = 360;
  const LEFT = 70;
  const RIGHT = 18;
  const TOP = 20;
  const BOTTOM = 72;
  const minT = windowRange.start;
  const maxT = windowRange.end;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const pad = Math.max(80, (maxV - minV) * 0.08);
  const lo = Math.max(0, minV - pad);
  const hi = maxV + pad;
  const plotWidth = W - LEFT - RIGHT;
  const plotHeight = H - TOP - BOTTOM;

  const x = (timestamp) => LEFT + (maxT === minT ? plotWidth / 2 : ((timestamp - minT) / (maxT - minT)) * plotWidth);
  const y = (value) => TOP + ((hi - value) / (hi - lo || 1)) * plotHeight;
  const pathFor = (key) => {
    let out = '';
    let open = false;
    for (const point of data) {
      const value = point[key];
      if (value == null) {
        open = false;
        continue;
      }
      out += `${open ? 'L' : 'M'}${x(point.t).toFixed(1)},${y(value).toFixed(1)} `;
      open = true;
    }
    return out;
  };
  const dots = (key) => data
    .filter((point) => point[key] != null)
    .map((point) => {
      const cx = x(point.t);
      const cy = y(point[key]);
      const attrs = `data-price="${point[key]}" data-date="${esc(point.checkedAt)}" cx="${cx}" cy="${cy}"`;
      return `<circle class="chart-point" ${attrs} r="5.5"></circle><circle class="chart-hit" ${attrs} r="36"></circle>`;
    })
    .join('');

  const yTicks = [0, 0.5, 1].map((ratio) => {
    const yy = TOP + ratio * plotHeight;
    const value = Math.round(hi - ratio * (hi - lo));
    return `<line class="gridline" x1="${LEFT}" x2="${W - RIGHT}" y1="${yy}" y2="${yy}"></line><text class="chart-y-label" x="${LEFT - 10}" y="${yy + 6}" text-anchor="end">${mobileChartPriceLabel(value)}</text>`;
  }).join('');

  const includeYear = new Date(minT).getFullYear() !== new Date(maxT).getFullYear();
  const tickTimes = mobileChartTickTimes(minT, maxT, mobileChartRange);
  const xLabels = tickTimes.map((timestamp, index) => {
    const anchor = index === 0 ? 'start' : index === tickTimes.length - 1 ? 'end' : 'middle';
    const xx = x(timestamp);
    return `<line class="chart-x-tick" x1="${xx}" x2="${xx}" y1="${H - BOTTOM}" y2="${H - BOTTOM + 8}"></line><text class="chart-x-label" x="${xx}" y="${H - 24}" text-anchor="${anchor}">${mobileChartDateLabel(timestamp, includeYear)}</text>`;
  }).join('');

  return `<div class="price-chart-mobile">${mobileChartRangeButtons()}<div class="legend mobile-chart-legend"><span class="sale">販売</span><span class="buy">買取</span><span class="rankb">ランクB</span><span class="timesale">タイムセール</span></div><div class="chart-wrap mobile-chart-wrap"><svg class="chart mobile-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="価格推移グラフ">${yTicks}${xLabels}<g class="sale"><path d="${pathFor('sale')}"></path>${dots('sale')}</g><g class="buy"><path d="${pathFor('buy')}"></path>${dots('buy')}</g><g class="rankb"><path d="${pathFor('rankb')}"></path>${dots('rankb')}</g><g class="timesale"><path d="${pathFor('timesale')}"></path>${dots('timesale')}</g></svg></div><div class="mobile-chart-hint">点をタップすると価格を表示</div></div>`;
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
