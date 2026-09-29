(() => {
  const app = document.querySelector('#app');
  const runtime = globalThis.PricewaveViewerEnhancements;
  if (!app || typeof runtime?.register !== 'function') return;

  const WIDTH = 960;
  const HEIGHT = 340;
  const LEFT = 92;
  const RIGHT = 18;
  const TOP = 18;
  const BOTTOM = 46;
  const AUTO_LOG_RATIO = 8;
  const PERIOD_OPTIONS = [
    ['day', '日（全期間）'],
    ['week', '週'],
    ['month', '月'],
  ];

  let seriesIndexPromise = null;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
  const yen = (value) => value == null ? '未取得' : `${Number(value).toLocaleString('ja-JP')}円`;
  const axisYen = (value) => `${Math.round(value).toLocaleString('ja-JP')}円`;

  function currentProductId() {
    const match = location.hash.match(/^#\/products\/(\d+)/u);
    return match ? Number(match[1]) : null;
  }

  function findPriceSection() {
    return [...app.querySelectorAll('section.panel.block')].find((section) =>
      section.querySelector('.section-title h2')?.textContent?.trim() === '価格推移',
    ) || null;
  }

  function loadSeriesIndex() {
    if (!seriesIndexPromise) {
      seriesIndexPromise = fetch('./data/series-index.json', { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { products: {} })
        .catch(() => ({ products: {} }));
    }
    return seriesIndexPromise;
  }

  function lineColor(index) {
    const hue = Math.round((index * 137.508) % 360);
    return `hsl(${hue} 64% 44%)`;
  }

  function startOfWeek(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
    return result;
  }

  function bucketKey(date, mode) {
    if (mode === 'month') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    const monday = startOfWeek(date);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }

  function aggregateHistories(histories, mode) {
    const valid = histories
      .flatMap((history) => {
        if (history.salePrice == null || !Number.isFinite(Number(history.salePrice))) return [];
        const timestamp = new Date(history.checkedAt).getTime();
        if (!Number.isFinite(timestamp)) return [];
        return [{
          checkedAt: history.checkedAt,
          timestamp,
          salePrice: Number(history.salePrice),
        }];
      })
      .sort((left, right) => left.timestamp - right.timestamp);

    if (mode === 'day') return valid;
    const buckets = new Map();
    for (const point of valid) {
      buckets.set(bucketKey(new Date(point.timestamp), mode), point);
    }
    return [...buckets.values()];
  }

  function parseLines(lines, mode) {
    const titleCounts = new Map();
    for (const line of lines) titleCounts.set(line.title, (titleCounts.get(line.title) || 0) + 1);

    return lines.flatMap((line, index) => {
      const points = aggregateHistories(line.histories || [], mode);
      if (!points.length) return [];
      const duplicateTitle = (titleCounts.get(line.title) || 0) > 1;
      const editionHint = line.modelNumber || `#${line.productId}`;
      return [{
        productId: line.productId,
        title: line.title,
        label: duplicateTitle ? `${line.title} [${editionHint}]` : line.title,
        points,
        currentPrice: points.at(-1)?.salePrice ?? null,
        color: lineColor(index),
      }];
    });
  }

  function pointAtOrBefore(line, timestamp) {
    let selected = null;
    for (const point of line.points) {
      if (point.timestamp > timestamp) break;
      selected = point;
    }
    return selected;
  }

  function nearestTimestamp(timestamps, target) {
    let nearest = timestamps[0] ?? target;
    let distance = Math.abs(nearest - target);
    for (let index = 1; index < timestamps.length; index += 1) {
      const nextDistance = Math.abs(timestamps[index] - target);
      if (nextDistance >= distance) continue;
      nearest = timestamps[index];
      distance = nextDistance;
    }
    return nearest;
  }

  function formatTick(timestamp, span) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(
      'ja-JP',
      span >= 365 * 24 * 60 * 60 * 1000
        ? { year: 'numeric', month: 'short' }
        : { month: 'numeric', day: 'numeric' },
    ).format(date);
  }

  function formatSelectedTime(timestamp, mode) {
    const date = new Date(timestamp);
    if (mode === 'month') {
      return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short' }).format(date);
    }
    if (mode === 'week') {
      return `${new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' }).format(date)}時点`;
    }
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(date);
  }

  function renderClosed(root, meta) {
    root.innerHTML = '<button class="viewer-series-toggle" type="button">シリーズ</button>';
    root.querySelector('.viewer-series-toggle')?.addEventListener('click', async () => {
      const button = root.querySelector('.viewer-series-toggle');
      if (button) {
        button.disabled = true;
        button.textContent = 'シリーズを読み込み中…';
      }
      try {
        const response = await fetch(`./${meta.path}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('series data unavailable');
        const data = await response.json();
        const chartState = {
          mode: 'day',
          scaleMode: 'auto',
          selectedProductId: null,
          hoveredProductId: null,
          selectedTimestamp: null,
        };
        renderOpen(root, data, chartState);
      } catch {
        root.innerHTML = '<p class="muted">シリーズ価格データを読み込めませんでした。</p>';
      }
    });
  }

  function renderOpen(root, data, chartState) {
    const parsedLines = parseLines(data.lines || [], chartState.mode);
    const allPoints = parsedLines.flatMap((line) => line.points);
    if (!allPoints.length) {
      root.innerHTML = '<button class="viewer-series-toggle" type="button">シリーズを閉じる</button><p class="muted">このシリーズで表示できる価格履歴がありません。</p>';
      root.querySelector('.viewer-series-toggle')?.addEventListener('click', () => renderClosed(root, {
        path: `data/series/${data.id}.json`,
      }));
      return;
    }

    const timestamps = allPoints.map((point) => point.timestamp);
    const selectionTimestamps = [...new Set(timestamps)].sort((left, right) => left - right);
    const prices = allPoints.map((point) => point.salePrice);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const activeTimestamp = chartState.selectedTimestamp ?? maxTimestamp;
    const timeSpan = Math.max(1, maxTimestamp - minTimestamp);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const canUseLogScale = rawMin > 0;
    const useLogScale = canUseLogScale && (
      chartState.scaleMode === 'log' ||
      (chartState.scaleMode === 'auto' && rawMax / rawMin >= AUTO_LOG_RATIO)
    );
    const plotWidth = WIDTH - LEFT - RIGHT;
    const plotHeight = HEIGHT - TOP - BOTTOM;
    const xAt = (timestamp) => minTimestamp === maxTimestamp
      ? LEFT + plotWidth / 2
      : LEFT + ((timestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * plotWidth;

    let yAt;
    let yTicks;
    if (useLogScale) {
      const rawLogMin = Math.log10(rawMin);
      const rawLogMax = Math.log10(rawMax);
      const logSpan = Math.max(0.05, rawLogMax - rawLogMin);
      const logPadding = logSpan * 0.08;
      const minLog = rawLogMin - logPadding;
      const maxLog = rawLogMax + logPadding;
      yAt = (price) => TOP + ((maxLog - Math.log10(Math.max(price, Number.MIN_VALUE))) / (maxLog - minLog)) * plotHeight;
      yTicks = Array.from({ length: 5 }, (_, index) => 10 ** (minLog + ((maxLog - minLog) * index) / 4));
    } else {
      const priceSpan = Math.max(1, rawMax - rawMin);
      const padding = Math.max(100, priceSpan * 0.08);
      const minPrice = Math.max(0, rawMin - padding);
      const maxPrice = rawMax + padding;
      yAt = (price) => TOP + ((maxPrice - price) / Math.max(1, maxPrice - minPrice)) * plotHeight;
      yTicks = Array.from({ length: 5 }, (_, index) => minPrice + ((maxPrice - minPrice) * index) / 4);
    }

    const xTicks = Array.from({ length: 6 }, (_, index) => minTimestamp + (timeSpan * index) / 5);
    const focusedProductId = chartState.selectedProductId ?? chartState.hoveredProductId;
    const selectedValues = parsedLines.flatMap((line) => {
      const point = pointAtOrBefore(line, activeTimestamp);
      return point ? [{ line, point }] : [];
    });
    const scaleDescription = useLogScale
      ? chartState.scaleMode === 'auto'
        ? '価格差が大きいため、自動で対数目盛にしています。縦軸には実際の価格を表示します。'
        : '対数目盛で表示しています。縦軸には実際の価格を表示します。'
      : '通常の金額差で表示しています。';

    const grid = yTicks.map((value) => {
      const y = yAt(value);
      return `<g><line class="viewer-series-grid" x1="${LEFT}" x2="${WIDTH - RIGHT}" y1="${y}" y2="${y}"></line><text class="viewer-series-axis-label viewer-series-y-label" x="${LEFT - 10}" y="${y + 4}">${esc(axisYen(value))}</text></g>`;
    }).join('');
    const ticks = xTicks.map((timestamp, index) => {
      const anchor = index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle';
      const x = LEFT + (plotWidth * index) / (xTicks.length - 1);
      return `<text class="viewer-series-axis-label" text-anchor="${anchor}" x="${x}" y="${HEIGHT - 14}">${esc(formatTick(timestamp, timeSpan))}</text>`;
    }).join('');

    const lineSvg = parsedLines.map((line) => {
      const path = line.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(point.timestamp).toFixed(2)},${yAt(point.salePrice).toFixed(2)}`).join(' ');
      const last = line.points.at(-1);
      const selectedPoint = pointAtOrBefore(line, activeTimestamp);
      const dimmed = focusedProductId !== null && focusedProductId !== line.productId;
      const focused = focusedProductId === line.productId;
      return `<g data-series-product="${line.productId}">
        <path class="viewer-series-hit-line" d="${path}" data-series-hit="${line.productId}"></path>
        <path class="viewer-series-line${focused ? ' is-focused' : ''}" d="${path}" opacity="${dimmed ? '0.12' : '1'}" stroke="${line.color}"><title>${esc(`${line.label} 現在 ${yen(line.currentPrice)}`)}</title></path>
        ${last ? `<circle class="viewer-series-end-point" cx="${xAt(last.timestamp)}" cy="${yAt(last.salePrice)}" opacity="${dimmed ? '0.12' : '1'}" r="${focused ? 4.5 : 3.2}" stroke="${line.color}"></circle>` : ''}
        ${selectedPoint ? `<circle class="viewer-series-selected-point" cx="${xAt(activeTimestamp)}" cy="${yAt(selectedPoint.salePrice)}" opacity="${dimmed ? '0.12' : '1'}" r="${focused ? 5 : 3.5}" stroke="${line.color}"><title>${esc(`${line.label} ${yen(selectedPoint.salePrice)}`)}</title></circle>` : ''}
      </g>`;
    }).join('');

    const readout = selectedValues.map(({ line, point }) => {
      const dimmed = focusedProductId !== null && focusedProductId !== line.productId;
      return `<span class="${dimmed ? 'is-dimmed' : ''}" data-readout-product="${line.productId}"><i style="background:${line.color}"></i>${esc(line.label)}: ${esc(yen(point.salePrice))}</span>`;
    }).join('');

    const legend = parsedLines.map((line) => {
      const dimmed = focusedProductId !== null && focusedProductId !== line.productId;
      return `<a class="${dimmed ? 'is-dimmed' : ''}" data-legend-product="${line.productId}" href="#/products/${line.productId}" title="${esc(`${line.label}の商品詳細を開く`)}"><i style="background:${line.color}"></i><b>${esc(line.label)}</b><em>${esc(yen(line.currentPrice))}</em></a>`;
    }).join('');

    root.innerHTML = `
      <div class="viewer-series-toolbar"><div><strong>${esc(data.name)}</strong><span class="muted">価格履歴あり ${parsedLines.length.toLocaleString('ja-JP')}商品 / 定義 ${Number(data.definedTitleCount || 0).toLocaleString('ja-JP')}作品</span></div><button class="viewer-series-toggle" type="button">シリーズを閉じる</button></div>
      <div class="viewer-series-periods" aria-label="シリーズ価格推移の表示単位">${PERIOD_OPTIONS.map(([value, label]) => `<button type="button" data-series-mode="${value}" aria-pressed="${chartState.mode === value}">${label}</button>`).join('')}</div>
      <p class="viewer-series-note">${chartState.mode === 'day' ? '全期間を取得時刻ごとに表示。グラフ上を動かすと、その時点の各商品価格を確認できます。' : chartState.mode === 'week' ? '全期間を週ごとの最終価格で表示' : '全期間を月ごとの最終価格で表示'}</p>
      <div class="viewer-series-scale"><span>縦軸</span><div>${['auto','linear','log'].map((value) => `<button type="button" data-series-scale="${value}" aria-pressed="${chartState.scaleMode === value}" ${value === 'log' && !canUseLogScale ? 'disabled' : ''}>${value === 'auto' ? '自動' : value === 'linear' ? '通常' : '対数'}</button>`).join('')}</div><span class="muted">${esc(scaleDescription)}</span></div>
      <div class="viewer-series-readout"><strong>${esc(formatSelectedTime(activeTimestamp, chartState.mode))}</strong><div>${readout}</div></div>
      <div class="viewer-series-chart-wrap"><svg class="viewer-series-chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${esc(`${data.name}シリーズの販売価格推移`)}">${grid}${ticks}<line class="viewer-series-selection-line" x1="${xAt(activeTimestamp)}" x2="${xAt(activeTimestamp)}" y1="${TOP}" y2="${TOP + plotHeight}"></line>${lineSvg}</svg></div>
      <p class="viewer-series-hint">商品名にカーソルを合わせると該当線を強調。商品名を押すとその商品詳細へ移動します。</p>
      <div class="viewer-series-legend" aria-label="${esc(`${data.name}シリーズの商品一覧`)}">${legend}</div>`;

    root.querySelector('.viewer-series-toggle')?.addEventListener('click', () => renderClosed(root, {
      path: `data/series/${data.id}.json`,
    }));
    root.querySelectorAll('[data-series-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        chartState.mode = button.dataset.seriesMode;
        chartState.selectedTimestamp = null;
        renderOpen(root, data, chartState);
      });
    });
    root.querySelectorAll('[data-series-scale]').forEach((button) => {
      button.addEventListener('click', () => {
        chartState.scaleMode = button.dataset.seriesScale;
        renderOpen(root, data, chartState);
      });
    });

    const setHover = (productId) => {
      chartState.hoveredProductId = productId;
      renderOpen(root, data, chartState);
    };
    root.querySelectorAll('[data-legend-product]').forEach((link) => {
      const productId = Number(link.dataset.legendProduct);
      link.addEventListener('pointerenter', () => setHover(productId));
      link.addEventListener('pointerleave', () => setHover(null));
    });
    root.querySelectorAll('[data-series-hit]').forEach((path) => {
      const productId = Number(path.dataset.seriesHit);
      path.addEventListener('pointerenter', () => setHover(productId));
      path.addEventListener('pointerleave', () => setHover(null));
      path.addEventListener('click', (event) => {
        event.stopPropagation();
        chartState.selectedProductId = chartState.selectedProductId === productId ? null : productId;
        renderOpen(root, data, chartState);
      });
    });

    const svg = root.querySelector('.viewer-series-chart');
    const selectByPointer = (event) => {
      const bounds = svg?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0) return;
      const viewX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
      const ratio = Math.max(0, Math.min(1, (viewX - LEFT) / plotWidth));
      const target = minTimestamp + ratio * (maxTimestamp - minTimestamp);
      chartState.selectedTimestamp = nearestTimestamp(selectionTimestamps, target);
      renderOpen(root, data, chartState);
    };
    svg?.addEventListener('pointerdown', selectByPointer);
    svg?.addEventListener('pointermove', selectByPointer);
  }

  async function decorateSeriesPriceChart() {
    const productId = currentProductId();
    if (!Number.isInteger(productId)) return;
    if (app.querySelector(`.viewer-series-price-root[data-product-id="${productId}"]`)) return;

    const priceSection = findPriceSection();
    if (!priceSection) return;

    const index = await loadSeriesIndex();
    if (currentProductId() !== productId) return;
    const meta = index?.products?.[String(productId)];
    if (!meta) return;

    const root = document.createElement('div');
    root.className = 'viewer-series-price-root';
    root.dataset.productId = String(productId);
    priceSection.appendChild(root);
    renderClosed(root, meta);
  }

  runtime.register('series-price-chart', decorateSeriesPriceChart);
})();
