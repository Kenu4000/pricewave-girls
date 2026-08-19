(() => {
  const PANEL_ID = "pricewave-history-panel";
  const SERIES = [
    { key: "salePrice", label: "販売価格", className: "sale", connectNulls: true },
    { key: "buyPrice", label: "買取価格", className: "buy", connectNulls: true },
    { key: "rankBPrice", label: "ランクB", className: "rankb", connectNulls: true },
    { key: "timeSalePrice", label: "タイムセール", className: "timesale", connectNulls: false },
  ];
  const MODES = [
    { value: "day", label: "日（全期間）" },
    { value: "week", label: "週" },
    { value: "month", label: "月" },
  ];

  let histories = [];
  let mode = "day";

  function productCode() {
    return location.pathname.match(/^\/product\/detail\/([0-9A-Za-z]+)\/?$/u)?.[1] ?? null;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/gu, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char]));
  }

  function pad(value) { return String(value).padStart(2, "0"); }
  function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function startOfWeek(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
    return result;
  }
  function bucketKey(date, chartMode) {
    if (chartMode === "month") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    return dateKey(startOfWeek(date));
  }
  function bucketLabel(date, chartMode) {
    if (chartMode === "month") return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short" }).format(date);
    return `${new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(startOfWeek(date))}週`;
  }
  function dayLabel(date, includeTime) {
    return new Intl.DateTimeFormat(
      "ja-JP",
      includeTime
        ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }
        : { month: "numeric", day: "numeric" },
    ).format(date);
  }

  function pointFromHistory(history, key, label) {
    const isTimeSale = history.isTimeSale === true;
    const rankB = history.conditionRank === "B" || Boolean(history.condition);
    const baseSalePrice = isTimeSale ? (history.regularSalePrice ?? history.salePrice) : history.salePrice;
    return {
      key,
      label,
      checkedAt: history.checkedAt,
      salePrice: rankB ? null : baseSalePrice,
      buyPrice: history.buyPrice,
      rankBPrice: rankB ? baseSalePrice : null,
      timeSalePrice: isTimeSale ? history.salePrice : null,
      timeSaleBasePrice: isTimeSale ? baseSalePrice : null,
    };
  }

  function aggregate(source, chartMode) {
    const valid = source
      .map((history) => ({ ...history, date: new Date(history.checkedAt) }))
      .filter((history) => !Number.isNaN(history.date.getTime()))
      .sort((left, right) => left.date.getTime() - right.date.getTime());
    if (!valid.length) return [];

    if (chartMode === "day") {
      const pointsPerDay = new Map();
      for (const history of valid) {
        const key = dateKey(history.date);
        pointsPerDay.set(key, (pointsPerDay.get(key) ?? 0) + 1);
      }
      return valid.map((history, index) => {
        const key = dateKey(history.date);
        return pointFromHistory(history, `${history.checkedAt}-${index}`, dayLabel(history.date, (pointsPerDay.get(key) ?? 0) > 1));
      });
    }

    const buckets = new Map();
    for (const history of valid) buckets.set(bucketKey(history.date, chartMode), history);
    return [...buckets.entries()].map(([key, history]) => pointFromHistory(history, key, bucketLabel(history.date, chartMode)));
  }

  function yen(value) { return value == null ? "-" : `${Number(value).toLocaleString("ja-JP")}円`; }
  function compactYen(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "-";
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

  function connectedPath(data, key, x, y) {
    return data.map((point, index) => ({ point, index }))
      .filter(({ point }) => point[key] != null)
      .map(({ point, index }, pathIndex) => `${pathIndex === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`)
      .join(" ");
  }

  function separatedPaths(data, key, x, y) {
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
    return segments.map((segment) => segment.map(({ point, index }, pathIndex) => `${pathIndex === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(" "));
  }

  function tickIndexes(length, compact) {
    if (length <= 1) return [0];
    const desired = Math.min(length, compact ? 4 : 7);
    const indexes = new Set([0, length - 1]);
    for (let index = 1; index < desired - 1; index += 1) indexes.add(Math.round(((length - 1) * index) / (desired - 1)));
    return [...indexes].sort((left, right) => left - right);
  }

  function readoutMarkup(point) {
    return `<div class="pricewave-history-readout" aria-live="polite"><strong class="pricewave-history-readout-date">${esc(point?.label || "取得点を選択")}</strong><div class="pricewave-history-readout-values">${SERIES.map((series) => `<span class="pricewave-history-readout-item ${series.className}"><i></i><span>${series.label}</span><b>${esc(yen(point?.[series.key]))}</b></span>`).join("")}</div></div>`;
  }

  function chartMarkup() {
    const data = aggregate(histories, mode);
    if (!data.length) return '<div class="pricewave-history-empty">価格履歴がありません。</div>';
    const values = data.flatMap((point) => [point.salePrice, point.buyPrice, point.rankBPrice, point.timeSalePrice, point.timeSaleBasePrice])
      .filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
    if (!values.length) return '<div class="pricewave-history-empty">価格データがありません。</div>';

    const compact = matchMedia("(max-width: 760px)").matches;
    const W = compact ? 720 : 1000;
    const H = compact ? 300 : 330;
    const LEFT = compact ? 64 : 84;
    const RIGHT = compact ? 10 : 18;
    const TOP = compact ? 10 : 16;
    const BOTTOM = compact ? 54 : 58;
    const plotWidth = W - LEFT - RIGHT;
    const plotHeight = H - TOP - BOTTOM;
    const plotBottom = TOP + plotHeight;
    const maxV = Math.max(...values);
    const hi = Math.max(100, maxV + Math.max(80, maxV * 0.08));
    const x = (index) => LEFT + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const y = (value) => TOP + ((hi - Number(value)) / hi) * plotHeight;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const yy = TOP + ratio * plotHeight;
      const value = Math.round(hi - ratio * hi);
      return `<line class="pricewave-history-gridline" x1="${LEFT}" x2="${W - RIGHT}" y1="${yy}" y2="${yy}"></line><text class="pricewave-history-y-label" x="${LEFT - 10}" y="${yy + 5}" text-anchor="end">${esc(compact ? compactYen(value) : yen(value))}</text>`;
    }).join("");

    const indexes = tickIndexes(data.length, compact);
    const xTicks = indexes.map((index, tickPosition) => {
      const anchor = tickPosition === 0 ? "start" : tickPosition === indexes.length - 1 ? "end" : "middle";
      return `<text class="pricewave-history-x-label" x="${x(index)}" y="${H - 18}" text-anchor="${anchor}">${esc(data[index].label)}</text>`;
    }).join("");

    const branches = data.map((point, index) => ({ point, index }))
      .filter(({ point }) => point.timeSalePrice != null && point.timeSaleBasePrice != null && point.timeSalePrice !== point.timeSaleBasePrice)
      .map(({ point, index }) => `<line class="pricewave-history-timesale-branch" x1="${x(index)}" x2="${x(index)}" y1="${y(point.timeSaleBasePrice)}" y2="${y(point.timeSalePrice)}"></line>`).join("");

    const seriesMarkup = SERIES.map((series) => {
      const paths = series.connectNulls ? [connectedPath(data, series.key, x, y)].filter(Boolean) : separatedPaths(data, series.key, x, y);
      const pathMarkup = paths.map((path) => `<path class="pricewave-history-line" d="${path}"></path>`).join("");
      const dots = data.map((point, index) => ({ point, index })).filter(({ point }) => point[series.key] != null)
        .map(({ point, index }) => `<circle class="pricewave-history-dot" cx="${x(index)}" cy="${y(point[series.key])}" r="${compact ? 3 : 3.5}"></circle>`).join("");
      return `<g class="pricewave-history-series ${series.className}">${pathMarkup}${dots}</g>`;
    }).join("");

    const initialPoint = data[data.length - 1];
    return `${readoutMarkup(initialPoint)}<div class="pricewave-history-chart-wrap"><svg class="pricewave-history-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Pricewave価格推移グラフ">${yTicks}${xTicks}${branches}${seriesMarkup}<line class="pricewave-history-crosshair" x1="${x(data.length - 1)}" x2="${x(data.length - 1)}" y1="${TOP}" y2="${plotBottom}"></line></svg></div>`;
  }

  function renderChart(panel) {
    const chartRoot = panel.querySelector(".pricewave-history-chart-root");
    if (!chartRoot) return;
    const data = aggregate(histories, mode);
    chartRoot.innerHTML = chartMarkup();
    panel.querySelectorAll("[data-pricewave-history-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.pricewaveHistoryMode === mode ? "true" : "false");
    });

    const svg = chartRoot.querySelector(".pricewave-history-chart");
    const crosshair = chartRoot.querySelector(".pricewave-history-crosshair");
    if (!svg || !crosshair || !chartRoot.querySelector(".pricewave-history-readout") || !data.length) return;
    const compact = matchMedia("(max-width: 760px)").matches;
    const W = compact ? 720 : 1000;
    const LEFT = compact ? 64 : 84;
    const RIGHT = compact ? 10 : 18;
    const plotWidth = W - LEFT - RIGHT;
    const x = (index) => LEFT + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);

    const update = (event) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const svgX = ((event.clientX - rect.left) / rect.width) * W;
      const relative = (svgX - LEFT) / plotWidth;
      const index = data.length <= 1 ? 0 : Math.max(0, Math.min(data.length - 1, Math.round(relative * (data.length - 1))));
      const point = data[index];
      crosshair.setAttribute("x1", String(x(index)));
      crosshair.setAttribute("x2", String(x(index)));
      const currentReadout = chartRoot.querySelector(".pricewave-history-readout");
      if (currentReadout) currentReadout.outerHTML = readoutMarkup(point);
    };
    svg.addEventListener("pointermove", update);
    svg.addEventListener("pointerdown", update);
  }

  function insertionTarget(panel) {
    const detailHeading = [...document.querySelectorAll("h2,h3,h4")]
      .find((heading) => heading.textContent?.replace(/\s+/gu, "").includes("商品詳細情報"));
    if (detailHeading?.parentElement) {
      detailHeading.parentElement.insertBefore(panel, detailHeading);
      return;
    }
    const main = document.querySelector("main, #contents, #main, .main-content, .contents");
    (main || document.body).prepend(panel);
  }

  async function mount() {
    const code = productCode();
    if (!code || document.getElementById(PANEL_ID)) return;
    await (document.readyState === "loading"
      ? new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }))
      : Promise.resolve());

    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "pricewave:history", productCode: code });
    } catch {
      return;
    }
    if (!response?.ok || !response.product || !Array.isArray(response.histories)) return;

    histories = response.histories;
    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.innerHTML = `<div class="pricewave-history-heading"><div><strong>Pricewave 価格推移</strong><span>${esc(response.product.title)}</span></div><a href="http://localhost:3000/products/${Number(response.product.id)}" target="_blank" rel="noreferrer">Pricewaveで開く</a></div><div class="pricewave-history-controls" role="group" aria-label="価格推移の表示単位">${MODES.map((option) => `<button type="button" data-pricewave-history-mode="${option.value}" aria-pressed="${option.value === mode ? "true" : "false"}">${option.label}</button>`).join("")}</div><div class="pricewave-history-legend">${SERIES.map((series) => `<span class="${series.className}"><i></i>${series.label}</span>`).join("")}</div><div class="pricewave-history-chart-root"></div>`;
    insertionTarget(panel);
    panel.querySelectorAll("[data-pricewave-history-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        mode = button.dataset.pricewaveHistoryMode || "day";
        renderChart(panel);
      });
    });
    renderChart(panel);
  }

  void mount();
})();
