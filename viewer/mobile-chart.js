let viewerChartMode = 'day';
let viewerChartSourceHistories = [];

const VIEWER_CHART_PERIODS = [
  { value: 'day', label: '日（全期間）' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
];

const VIEWER_CHART_SERIES = [
  { key: 'salePrice', label: '販売価格', className: 'sale', connectNulls: true },
  { key: 'buyPrice', label: '買取価格', className: 'buy', connectNulls: true },
  { key: 'rankBPrice', label: 'ランクB', className: 'rankb', connectNulls: true },
  { key: 'timeSalePrice', label: 'タイムセール', className: 'timesale', connectNulls: false },
];

function viewerChartPad(value) {
  return String(value).padStart(2, '0');
}

function viewerChartDateKey(date) {
  return `${date.getFullYear()}-${viewerChartPad(date.getMonth() + 1)}-${viewerChartPad(date.getDate())}`;
}

function viewerChartStartOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function viewerChartBucketKey(date, mode) {
  if (mode === 'month') {
    return `${date.getFullYear()}-${viewerChartPad(date.getMonth() + 1)}`;
  }
  return viewerChartDateKey(viewerChartStartOfWeek(date));
}

function viewerChartBucketLabel(date, mode) {
  if (mode === 'month') {
    return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short' }).format(date);
  }
  return `${new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(viewerChartStartOfWeek(date))}週`;
}

function viewerChartDayLabel(date, includeTime) {
  return new Intl.DateTimeFormat(
    'ja-JP',
    includeTime
      ? {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }
      : { month: 'numeric', day: 'numeric' },
  ).format(date);
}

function viewerChartPoint(history, key, label) {
  const isTimeSale = history.isTimeSale === true;
  const conditionRank = history.conditionRank === 'B' || history.condition ? 'B' : 'A';
  const baseSalePrice = isTimeSale
    ? (history.regularSalePrice ?? history.salePrice)
    : history.salePrice;

  return {
    key,
    label,
    checkedAt: history.checkedAt,
    salePrice: conditionRank === 'B' ? null : baseSalePrice,
    buyPrice: history.buyPrice,
    rankBPrice: conditionRank === 'B' ? baseSalePrice : null,
    timeSalePrice: isTimeSale ? history.salePrice : null,
    timeSaleBasePrice: isTimeSale ? baseSalePrice : null,
  };
}

function viewerAggregatePriceChartData(histories, mode) {
  const valid = histories
    .map((history) => ({ ...history, date: new Date(history.checkedAt) }))
    .filter((history) => !Number.isNaN(history.date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (!valid.length) return [];

  if (mode === 'day') {
    const pointsPerDay = new Map();
    for (const history of valid) {
      const key = viewerChartDateKey(history.date);
      pointsPerDay.set(key, (pointsPerDay.get(key) ?? 0) + 1);
    }

    return valid.map((history, index) => {
      const key = viewerChartDateKey(history.date);
      return viewerChartPoint(
        history,
        `${history.checkedAt}-${index}`,
        viewerChartDayLabel(history.date, (pointsPerDay.get(key) ?? 0) > 1),
      );
    });
  }

  const buckets = new Map();
  for (const history of valid) {
    buckets.set(viewerChartBucketKey(history.date, mode), history);
  }

  return [...buckets.entries()].map(([key, history]) =>
    viewerChartPoint(history, key, viewerChartBucketLabel(history.date, mode)),
  );
}

function viewerChartYen(value) {
  if (value == null) return '-';
  return `${Number(value).toLocaleString('ja-JP')}円`;
}

function viewerChartCompactYen(value) {
  if (value == null) return '-';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  if (Math.abs(amount) >= 10000) {
    const man = amount / 10000;
    return `${Number.isInteger(man) ? man.toFixed(0) : man.toFixed(1)}万`;
  }
  if (Math.abs(amount) >= 1000) {
    const thousand = amount / 1000;
    return `${Number.isInteger(thousand) ? thousand.toFixed(0) : thousand.toFixed(1)}千`;
  }
  return String(amount);
}

function viewerChartNote(mode) {
  if (mode === 'day') {
    return '全期間を取得時刻ごとに表示。黄色は通常価格から一時的に分岐したタイムセール価格';
  }
  if (mode === 'week') return '全期間を週ごとの最終価格で表示';
  return '全期間を月ごとの最終価格で表示';
}

function viewerChartControls() {
  return `<div class="viewer-chart-controls" role="group" aria-label="価格推移の表示単位">${VIEWER_CHART_PERIODS.map(
    (option) =>
      `<button type="button" data-viewer-chart-mode="${option.value}" aria-pressed="${viewerChartMode === option.value ? 'true' : 'false'}">${option.label}</button>`,
  ).join('')}</div>`;
}

function viewerChartLegend() {
  return `<div class="viewer-chart-legend" aria-label="価格系列">${VIEWER_CHART_SERIES.map(
    (series) => `<span class="${series.className}">${series.label}</span>`,
  ).join('')}</div>`;
}

function viewerChartConnectedPath(data, key, x, y) {
  const points = data
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point[key] != null);
  return points
    .map(({ point, index }, pathIndex) =>
      `${pathIndex === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`,
    )
    .join(' ');
}

function viewerChartSeparatedPaths(data, key, x, y) {
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

  return segments.map((segment) =>
    segment
      .map(({ point, index }, pathIndex) =>
        `${pathIndex === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`,
      )
      .join(' '),
  );
}

function viewerChartTickIndexes(length, compact) {
  if (length <= 1) return [0];
  const desired = Math.min(length, compact ? 4 : 7);
  const indexes = new Set([0, length - 1]);
  for (let index = 1; index < desired - 1; index += 1) {
    indexes.add(Math.round(((length - 1) * index) / (desired - 1)));
  }
  return [...indexes].sort((left, right) => left - right);
}

renderChart = function renderMainBasedViewerChart(histories) {
  if (viewerChartSourceHistories !== histories) viewerChartMode = 'day';
  viewerChartSourceHistories = histories;
  const data = viewerAggregatePriceChartData(histories, viewerChartMode);
  if (!data.length) return '<div class="panel empty">価格履歴がありません。</div>';

  const values = data
    .flatMap((point) => [
      point.salePrice,
      point.buyPrice,
      point.rankBPrice,
      point.timeSalePrice,
      point.timeSaleBasePrice,
    ])
    .filter((value) => value != null && Number.isFinite(Number(value)))
    .map(Number);
  if (!values.length) return '<div class="panel empty">価格データがありません。</div>';

  const compact = matchMedia('(max-width: 760px)').matches;
  const W = compact ? 720 : 1000;
  const H = compact ? 300 : 330;
  const LEFT = compact ? 64 : 84;
  const RIGHT = compact ? 10 : 18;
  const TOP = compact ? 10 : 16;
  const BOTTOM = compact ? 54 : 58;
  const plotWidth = W - LEFT - RIGHT;
  const plotHeight = H - TOP - BOTTOM;
  const maxV = Math.max(...values);
  const hi = Math.max(100, maxV + Math.max(80, maxV * 0.08));

  const x = (index) =>
    LEFT + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value) => TOP + ((hi - Number(value)) / hi) * plotHeight;

  const yTicks = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const yy = TOP + ratio * plotHeight;
      const value = Math.round(hi - ratio * hi);
      const label = compact ? viewerChartCompactYen(value) : viewerChartYen(value);
      return `<line class="viewer-chart-gridline" x1="${LEFT}" x2="${W - RIGHT}" y1="${yy}" y2="${yy}"></line><text class="viewer-chart-y-label" x="${LEFT - 10}" y="${yy + (compact ? 5 : 4)}" text-anchor="end">${esc(label)}</text>`;
    })
    .join('');

  const tickIndexes = viewerChartTickIndexes(data.length, compact);
  const xTicks = tickIndexes
    .map((index, tickPosition) => {
      const point = data[index];
      const anchor =
        tickPosition === 0 ? 'start' : tickPosition === tickIndexes.length - 1 ? 'end' : 'middle';
      return `<text class="viewer-chart-x-label" x="${x(index)}" y="${H - (compact ? 18 : 16)}" text-anchor="${anchor}">${esc(point.label)}</text>`;
    })
    .join('');

  const branches = data
    .map((point, index) => ({ point, index }))
    .filter(
      ({ point }) =>
        point.timeSalePrice != null &&
        point.timeSaleBasePrice != null &&
        point.timeSalePrice !== point.timeSaleBasePrice,
    )
    .map(
      ({ point, index }) =>
        `<line class="viewer-chart-timesale-branch" x1="${x(index)}" x2="${x(index)}" y1="${y(point.timeSaleBasePrice)}" y2="${y(point.timeSalePrice)}"></line>`,
    )
    .join('');

  const seriesMarkup = VIEWER_CHART_SERIES.map((series) => {
    const paths = series.connectNulls
      ? [viewerChartConnectedPath(data, series.key, x, y)].filter(Boolean)
      : viewerChartSeparatedPaths(data, series.key, x, y);
    const pathMarkup = paths
      .map(
        (path) =>
          `<path class="viewer-chart-line" data-viewer-chart-series="${series.key}" d="${path}"></path>`,
      )
      .join('');

    const visibleDots = data
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => point[series.key] != null)
      .map(({ point, index }) => {
        const showDot = !compact || series.key === 'timeSalePrice';
        return showDot
          ? `<circle class="viewer-chart-dot" cx="${x(index)}" cy="${y(point[series.key])}" r="${series.key === 'timeSalePrice' ? (compact ? 2.5 : 4) : 3}"></circle>`
          : '';
      })
      .join('');

    return `<g class="viewer-chart-series ${series.className}">${pathMarkup}${visibleDots}</g>`;
  }).join('');


  return `<div class="viewer-price-chart">${viewerChartControls()}<p class="viewer-chart-note">${esc(viewerChartNote(viewerChartMode))}</p>${viewerChartLegend()}<div class="viewer-chart-wrap"><svg class="viewer-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="価格推移グラフ">${yTicks}${xTicks}${branches}${seriesMarkup}</svg></div></div>`;
};

bindChartTooltips = function bindMainBasedViewerChart() {
  const root = document.querySelector('.viewer-price-chart');
  if (!root) return;

  root.querySelectorAll('[data-viewer-chart-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.viewerChartMode;
      if (!['day', 'week', 'month'].includes(nextMode) || nextMode === viewerChartMode) return;
      viewerChartMode = nextMode;
      root.outerHTML = renderChart(viewerChartSourceHistories);
      bindChartTooltips();
    });
  });
};
