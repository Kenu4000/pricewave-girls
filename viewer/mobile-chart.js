const desktopRenderChart = renderChart;

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

function mobileChartDateLabel(timestamp, includeYear) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('ja-JP', includeYear
    ? { year: '2-digit', month: 'numeric', day: 'numeric' }
    : { month: 'numeric', day: 'numeric' });
}

renderChart = function renderResponsiveChart(histories) {
  if (!matchMedia('(max-width: 760px)').matches) {
    return desktopRenderChart(histories);
  }

  const data = graphSeries(histories);
  if (!data.length) return '<div class="panel empty">価格履歴がありません。</div>';

  const values = data.flatMap((point) => [point.sale, point.buy, point.rankb, point.timesale]).filter((value) => value != null);
  if (!values.length) return '<div class="panel empty">価格データがありません。</div>';

  const W = 720;
  const H = 280;
  const LEFT = 64;
  const RIGHT = 16;
  const TOP = 18;
  const BOTTOM = 48;
  const minT = Math.min(...data.map((point) => point.t));
  const maxT = Math.max(...data.map((point) => point.t));
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const pad = Math.max(80, (maxV - minV) * 0.07);
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
    .map((point) => `<circle class="chart-dot" data-price="${point[key]}" data-date="${esc(point.checkedAt)}" cx="${x(point.t)}" cy="${y(point[key])}" r="3.5" fill="currentColor"></circle>`)
    .join('');

  const yTicks = [0, 0.5, 1].map((ratio) => {
    const yy = TOP + ratio * plotHeight;
    const value = Math.round(hi - ratio * (hi - lo));
    return `<line class="gridline" x1="${LEFT}" x2="${W - RIGHT}" y1="${yy}" y2="${yy}"></line><text class="chart-y-label" x="${LEFT - 9}" y="${yy + 5}" text-anchor="end">${mobileChartPriceLabel(value)}</text>`;
  }).join('');

  const firstT = data[0].t;
  const middleT = data[Math.floor((data.length - 1) / 2)].t;
  const lastT = data[data.length - 1].t;
  const includeYear = new Date(firstT).getFullYear() !== new Date(lastT).getFullYear();
  const xLabels = [
    { t: firstT, anchor: 'start' },
    { t: middleT, anchor: 'middle' },
    { t: lastT, anchor: 'end' },
  ].map(({ t, anchor }) => `<text class="chart-x-label" x="${x(t)}" y="${H - 11}" text-anchor="${anchor}">${mobileChartDateLabel(t, includeYear)}</text>`).join('');

  return `<div class="price-chart-mobile"><div class="legend mobile-chart-legend"><span class="sale">販売</span><span class="buy">買取</span><span class="rankb">ランクB</span><span class="timesale">タイムセール</span></div><div class="chart-wrap mobile-chart-wrap"><svg class="chart mobile-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="価格推移グラフ">${yTicks}${xLabels}<g class="sale"><path d="${pathFor('sale')}"></path>${dots('sale')}</g><g class="buy"><path d="${pathFor('buy')}"></path>${dots('buy')}</g><g class="rankb"><path d="${pathFor('rankb')}"></path>${dots('rankb')}</g><g class="timesale"><path d="${pathFor('timesale')}"></path>${dots('timesale')}</g></svg></div></div>`;
};
