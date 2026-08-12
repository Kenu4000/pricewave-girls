const desktopRenderChart = renderChart;
const desktopBindChartTooltips = bindChartTooltips;

let mobileChartRange = 'week';
let mobileChartSourceHistories = [];

const MOBILE_CHART_SERIES_LABELS = {
  sale: '販売',
  buy: '買取',
  rankb: 'ランクB',
  timesale: 'タイムセール',
};

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
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const spread = Math.max(1, maxV - minV);
  const pad = Math.max(120, spread * 0.16);
  const lo = Math.max(0, minV - pad);
  const hi = maxV + pad;
  const plotWidth = W - LEFT - RIGHT;
  const plotHeight = H - TOP - BOTTOM;
  const plotBottom = H - BOTTOM;

  const xByTime = (timestamp) => LEFT + (maxT === minT ? plotWidth / 2 : ((timestamp - minT) / (maxT - minT)) * plotWidth);
  const xByIndex = (index) => LEFT + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const x = (point, index) => mobileChartRange === 'week' ? xByIndex(index) : xByTime(point.t);
  const y = (value) => TOP + ((hi - value) / (hi - lo || 1)) * plotHeight;

  const segmentsFor = (key) => {
    const segments = [];
    let current = [];
    data.forEach((point, index) => {
      if (point[key] == null) {
        if (current.length) segments.push(current);
        current = [];
        return;
      }
      current.push({ point, index });
    });
    if (current.length) segments.push(current);
    return segments;
  };

  const linePathForSegment = (segment, key) => segment
    .map(({ point, index }, segmentIndex) => `${segmentIndex ? 'L' : 'M'}${x(point, index).toFixed(1)},${y(point[key]).toFixed(1)}`)
    .join(' ');

  const areaPathForSegment = (segment, key) => {
    const first = segment[0];
    const last = segment[segment.length - 1];
    const line = linePathForSegment(segment, key);
    return `M${x(first.point, first.index).toFixed(1)},${plotBottom} ${line.replace(/^M/, 'L')} L${x(last.point, last.index).toFixed(1)},${plotBottom} Z`;
  };

  const pointsFor = (key) => data
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point[key] != null)
    .map(({ point, index }) => {
      const cx = x(point, index);
      const cy = y(point[key]);
      return `<circle class="chart-point" data-series="${key}" data-price="${point[key]}" data-date="${esc(point.checkedAt)}" cx="${cx}" cy="${cy}" r="3"></circle><circle class="chart-point-hit" data-chart-series-hit data-series="${key}" cx="${cx}" cy="${cy}" r="28"></circle>`;
    })
    .join('');

  const seriesGroup = (key) => {
    const segments = segmentsFor(key);
    const paths = segments.map((segment) => {
      const linePath = linePathForSegment(segment, key);
      const areaPath = areaPathForSegment(segment, key);
      return `<path class="chart-area" d="${areaPath}"></path><path class="chart-area-hit" data-chart-series-hit data-series="${key}" d="${areaPath}"></path><path class="chart-line" d="${linePath}"></path><path class="chart-line-hit" data-chart-series-hit data-series="${key}" d="${linePath}"></path>`;
    }).join('');
    return `<g class="${key}" data-series-group="${key}">${paths}${pointsFor(key)}</g>`;
  };

  const yTicks = [0, 0.5, 1].map((ratio) => {
    const yy = TOP + ratio * plotHeight;
    const value = Math.round(hi - ratio * (hi - lo));
    return `<line class="gridline" x1="${LEFT}" x2="${W - RIGHT}" y1="${yy}" y2="${yy}"></line><text class="chart-y-label" x="${LEFT - 10}" y="${yy + 6}" text-anchor="end">${mobileChartPriceLabel(value)}</text>`;
  }).join('');

  const includeYear = new Date(minT).getFullYear() !== new Date(maxT).getFullYear();
  let xLabels = '';
  if (mobileChartRange === 'week') {
    xLabels = data.map((point, index) => {
      const xx = x(point, index);
      const anchor = index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle';
      return `<text class="chart-x-label" x="${xx}" y="${H - 24}" text-anchor="${anchor}">${mobileChartDateLabel(point.t, includeYear)}</text>`;
    }).join('');
  } else {
    const count = mobileChartRange === 'month' ? 5 : 3;
    const tickTimes = maxT <= minT
      ? [minT]
      : Array.from({ length: count }, (_, index) => minT + ((maxT - minT) * index) / (count - 1));
    xLabels = tickTimes.map((timestamp, index) => {
      const xx = xByTime(timestamp);
      const anchor = index === 0 ? 'start' : index === tickTimes.length - 1 ? 'end' : 'middle';
      return `<text class="chart-x-label" x="${xx}" y="${H - 24}" text-anchor="${anchor}">${mobileChartDateLabel(timestamp, includeYear)}</text>`;
    }).join('');
  }

  return `<div class="price-chart-mobile">${mobileChartRangeButtons()}<div class="legend mobile-chart-legend"><span class="sale">販売</span><span class="buy">買取</span><span class="rankb">ランクB</span><span class="timesale">タイムセール</span></div><div class="mobile-chart-readout" hidden></div><div class="chart-wrap mobile-chart-wrap"><svg class="chart mobile-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="価格推移グラフ">${yTicks}${xLabels}${seriesGroup('sale')}${seriesGroup('buy')}${seriesGroup('rankb')}${seriesGroup('timesale')}<line class="chart-crosshair" x1="0" x2="0" y1="${TOP}" y2="${plotBottom}" hidden></line><circle class="chart-active-point" cx="0" cy="0" r="8" hidden></circle></svg></div><div class="mobile-chart-hint">色の面や線を触って左右に動かすと、その日の価格を表示</div></div>`;
};

bindChartTooltips = function bindResponsiveChartTooltips() {
  if (!matchMedia('(max-width: 760px)').matches) {
    return desktopBindChartTooltips();
  }

  const svg = document.querySelector('.mobile-chart');
  const crosshair = svg?.querySelector('.chart-crosshair');
  const activePoint = svg?.querySelector('.chart-active-point');
  const readout = document.querySelector('.mobile-chart-readout');
  let activePointerId = null;
  let activeSeries = null;

  const eventToSvgX = (event) => {
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    if (!rect.width) return 0;
    return viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width;
  };

  const nearestPoint = (series, targetX) => {
    const points = [...(svg?.querySelectorAll(`.chart-point[data-series="${series}"]`) || [])];
    if (!points.length) return null;
    return points.reduce((best, point) => {
      const distance = Math.abs(Number(point.getAttribute('cx')) - targetX);
      return !best || distance < best.distance ? { point, distance } : best;
    }, null)?.point || null;
  };

  const selectPoint = (series, event) => {
    if (!svg || !crosshair || !activePoint || !readout) return;
    const point = nearestPoint(series, eventToSvgX(event));
    if (!point) return;
    const cx = Number(point.getAttribute('cx'));
    const cy = Number(point.getAttribute('cy'));
    const price = Number(point.dataset.price);
    const checkedAt = point.dataset.date;

    crosshair.setAttribute('x1', String(cx));
    crosshair.setAttribute('x2', String(cx));
    crosshair.hidden = false;
    activePoint.setAttribute('cx', String(cx));
    activePoint.setAttribute('cy', String(cy));
    activePoint.setAttribute('class', `chart-active-point ${series}`);
    activePoint.hidden = false;
    readout.textContent = `${MOBILE_CHART_SERIES_LABELS[series] || series}  ${yen(price)}  ·  ${dateTime(checkedAt)}`;
    readout.hidden = false;
  };

  document.querySelectorAll('[data-chart-series-hit]').forEach((hit) => {
    hit.addEventListener('pointerdown', (event) => {
      activePointerId = event.pointerId;
      activeSeries = hit.dataset.series;
      hit.setPointerCapture?.(event.pointerId);
      selectPoint(activeSeries, event);
    });
    hit.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse' && activePointerId == null) {
        selectPoint(hit.dataset.series, event);
        return;
      }
      if (event.pointerId === activePointerId && activeSeries) {
        selectPoint(activeSeries, event);
      }
    });
    const finish = (event) => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      activeSeries = null;
    };
    hit.addEventListener('pointerup', finish);
    hit.addEventListener('pointercancel', finish);
  });

  document.querySelectorAll('[data-mobile-chart-range]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextRange = button.dataset.mobileChartRange;
      if (!['week', 'month', 'all'].includes(nextRange) || nextRange === mobileChartRange) return;
      mobileChartRange = nextRange;
      const chartRoot = document.querySelector('.price-chart-mobile');
      if (!chartRoot) return;
      chartRoot.outerHTML = renderChart(mobileChartSourceHistories);
      bindChartTooltips();
    });
  });
};
