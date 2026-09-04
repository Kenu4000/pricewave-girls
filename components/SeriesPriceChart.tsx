"use client";

import Link from "next/link";
import { useMemo, useState, type PointerEvent } from "react";
import {
  aggregatePriceChartData,
  type PriceChartMode,
} from "@/lib/price-chart-data";
import styles from "./SeriesPriceChart.module.css";

export type SeriesPriceHistoryPoint = {
  checkedAt: string;
  salePrice: number | null;
  buyPrice: number | null;
};

export type SeriesPriceLine = {
  productId: number;
  title: string;
  histories: SeriesPriceHistoryPoint[];
};

type ParsedPoint = {
  checkedAt: string;
  timestamp: number;
  price: number;
};

type ParsedLine = {
  productId: number;
  title: string;
  label: string;
  points: ParsedPoint[];
  currentPrice: number | null;
  color: string;
};

type ScaleMode = "auto" | "linear" | "log";
type SeriesPriceMetric = "sale" | "buy";

const PERIOD_OPTIONS: Array<{ value: PriceChartMode; label: string }> = [
  { value: "day", label: "日（全期間）" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
];

const PRICE_OPTIONS: Array<{ value: SeriesPriceMetric; label: string }> = [
  { value: "sale", label: "販売" },
  { value: "buy", label: "買取" },
];

const WIDTH = 960;
const HEIGHT = 340;
const LEFT = 92;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 46;
const AUTO_LOG_RATIO = 8;

function yen(value: number | null): string {
  return value == null ? "未取得" : `${value.toLocaleString("ja-JP")}円`;
}

function axisYen(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function lineColor(index: number): string {
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue} 64% 44%)`;
}

function formatTick(timestamp: number, span: number): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(
    "ja-JP",
    span >= 365 * 24 * 60 * 60 * 1000
      ? { year: "numeric", month: "short" }
      : { month: "numeric", day: "numeric" },
  ).format(date);
}

function formatSelectedTime(timestamp: number, mode: PriceChartMode): string {
  const date = new Date(timestamp);
  if (mode === "month") {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short" }).format(date);
  }
  if (mode === "week") {
    return `${new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date)}時点`;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function parseLines(
  lines: SeriesPriceLine[],
  mode: PriceChartMode,
  metric: SeriesPriceMetric,
): ParsedLine[] {
  const titleCounts = new Map<string, number>();
  for (const line of lines) {
    titleCounts.set(line.title, (titleCounts.get(line.title) ?? 0) + 1);
  }

  return lines.flatMap((line, index) => {
    const aggregated = aggregatePriceChartData(
      line.histories.map((history) => ({
        checkedAt: history.checkedAt,
        salePrice: history.salePrice,
        buyPrice: history.buyPrice,
      })),
      mode,
    );
    const points = aggregated.flatMap((history) => {
      const price = metric === "sale" ? history.salePrice : history.buyPrice;
      if (price == null || !Number.isFinite(price)) return [];
      const timestamp = new Date(history.checkedAt).getTime();
      if (!Number.isFinite(timestamp)) return [];
      return [{ checkedAt: history.checkedAt, timestamp, price }];
    });
    if (points.length === 0) return [];
    return [{
      productId: line.productId,
      title: line.title,
      label: (titleCounts.get(line.title) ?? 0) > 1
        ? `${line.title} [#${line.productId}]`
        : line.title,
      points,
      currentPrice: points.at(-1)?.price ?? null,
      color: lineColor(index),
    }];
  });
}

function pointAtOrBefore(line: ParsedLine, timestamp: number): ParsedPoint | null {
  let selected: ParsedPoint | null = null;
  for (const point of line.points) {
    if (point.timestamp > timestamp) break;
    selected = point;
  }
  return selected;
}

function nearestTimestamp(timestamps: number[], target: number): number {
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

export function SeriesPriceChart({
  seriesName,
  definedTitleCount,
  lines,
}: {
  seriesName: string;
  definedTitleCount: number;
  lines: SeriesPriceLine[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PriceChartMode>("day");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("auto");
  const [priceMetric, setPriceMetric] = useState<SeriesPriceMetric>(() =>
    lines.some((line) => line.histories.some((history) => history.salePrice !== null)) ? "sale" : "buy",
  );
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [hoveredProductId, setHoveredProductId] = useState<number | null>(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const hasSalePrices = lines.some((line) => line.histories.some((history) => history.salePrice !== null));
  const hasBuyPrices = lines.some((line) => line.histories.some((history) => history.buyPrice !== null));
  const parsedLines = useMemo(
    () => parseLines(lines, mode, priceMetric),
    [lines, mode, priceMetric],
  );
  const allPoints = parsedLines.flatMap((line) => line.points);
  const priceLabel = priceMetric === "sale" ? "販売価格" : "買取価格";

  if (!open) {
    return (
      <div className={styles.root}>
        <button className={styles.toggleButton} onClick={() => setOpen(true)} type="button">
          シリーズ
        </button>
      </div>
    );
  }

  if (allPoints.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <strong>{seriesName}</strong>
          <button className={styles.toggleButton} onClick={() => setOpen(false)} type="button">
            シリーズを閉じる
          </button>
        </div>
        <div className={styles.scaleToolbar}>
          <span>価格</span>
          <div aria-label="シリーズ価格の種別" className={styles.scaleButtons}>
            {PRICE_OPTIONS.map((option) => (
              <button
                aria-pressed={priceMetric === option.value}
                disabled={option.value === "sale" ? !hasSalePrices : !hasBuyPrices}
                key={option.value}
                onClick={() => setPriceMetric(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted">このシリーズで表示できる{priceLabel}履歴がありません。</p>
      </div>
    );
  }

  const timestamps = allPoints.map((point) => point.timestamp);
  const selectionTimestamps = [...new Set(timestamps)].sort((left, right) => left - right);
  const prices = allPoints.map((point) => point.price);
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const activeTimestamp = selectedTimestamp ?? maxTimestamp;
  const timeSpan = Math.max(1, maxTimestamp - minTimestamp);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const canUseLogScale = rawMin > 0;
  const useLogScale = canUseLogScale && (
    scaleMode === "log" ||
    (scaleMode === "auto" && rawMax / rawMin >= AUTO_LOG_RATIO)
  );
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const xAt = (timestamp: number) =>
    minTimestamp === maxTimestamp
      ? LEFT + plotWidth / 2
      : LEFT + ((timestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * plotWidth;

  let yAt: (price: number) => number;
  let yTicks: number[];

  if (useLogScale) {
    const rawLogMin = Math.log10(rawMin);
    const rawLogMax = Math.log10(rawMax);
    const logSpan = Math.max(0.05, rawLogMax - rawLogMin);
    const logPadding = logSpan * 0.08;
    const minLog = rawLogMin - logPadding;
    const maxLog = rawLogMax + logPadding;
    yAt = (price: number) =>
      TOP + ((maxLog - Math.log10(Math.max(price, Number.MIN_VALUE))) / (maxLog - minLog)) * plotHeight;
    yTicks = Array.from({ length: 5 }, (_, index) =>
      10 ** (minLog + ((maxLog - minLog) * index) / 4),
    );
  } else {
    const priceSpan = Math.max(1, rawMax - rawMin);
    const padding = Math.max(100, priceSpan * 0.08);
    const minPrice = Math.max(0, rawMin - padding);
    const maxPrice = rawMax + padding;
    yAt = (price: number) =>
      TOP + ((maxPrice - price) / Math.max(1, maxPrice - minPrice)) * plotHeight;
    yTicks = Array.from({ length: 5 }, (_, index) =>
      minPrice + ((maxPrice - minPrice) * index) / 4,
    );
  }

  const xTicks = Array.from({ length: 6 }, (_, index) =>
    minTimestamp + (timeSpan * index) / 5,
  );
  const focusedProductId = selectedProductId ?? hoveredProductId;
  const selectedValues = parsedLines.flatMap((line) => {
    const point = pointAtOrBefore(line, activeTimestamp);
    return point ? [{ line, point }] : [];
  });
  const scaleDescription = useLogScale
    ? scaleMode === "auto"
      ? "価格差が大きいため、自動で対数目盛にしています。縦軸には実際の価格を表示します。"
      : "対数目盛で表示しています。縦軸には実際の価格を表示します。"
    : "通常の金額差で表示しています。";

  const selectByPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const viewX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const ratio = Math.max(0, Math.min(1, (viewX - LEFT) / plotWidth));
    const target = minTimestamp + ratio * (maxTimestamp - minTimestamp);
    setSelectedTimestamp(nearestTimestamp(selectionTimestamps, target));
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div>
          <strong>{seriesName}</strong>
          <span className={styles.count}>
            {priceLabel}履歴あり {parsedLines.length.toLocaleString("ja-JP")} / 定義 {definedTitleCount.toLocaleString("ja-JP")}作品
          </span>
        </div>
        <button className={styles.toggleButton} onClick={() => setOpen(false)} type="button">
          シリーズを閉じる
        </button>
      </div>

      <div className={styles.scaleToolbar}>
        <span>価格</span>
        <div aria-label="シリーズ価格の種別" className={styles.scaleButtons}>
          {PRICE_OPTIONS.map((option) => (
            <button
              aria-pressed={priceMetric === option.value}
              disabled={option.value === "sale" ? !hasSalePrices : !hasBuyPrices}
              key={option.value}
              onClick={() => {
                setPriceMetric(option.value);
                setSelectedTimestamp(null);
                setSelectedProductId(null);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div aria-label="シリーズ価格推移の表示単位" className={styles.controls}>
        {PERIOD_OPTIONS.map((option) => (
          <button
            aria-pressed={mode === option.value}
            className={styles.periodButton}
            key={option.value}
            onClick={() => {
              setMode(option.value);
              setSelectedTimestamp(null);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className={styles.note}>
        {mode === "day"
          ? `全期間を取得時刻ごとに表示。グラフ上を動かすと、その時点の各作品${priceLabel}を確認できます。`
          : mode === "week"
            ? `全期間の${priceLabel}を週ごとの最終価格で表示`
            : `全期間の${priceLabel}を月ごとの最終価格で表示`}
      </p>

      <div className={styles.scaleToolbar}>
        <span>縦軸</span>
        <div aria-label="シリーズ価格グラフの縦軸" className={styles.scaleButtons}>
          <button aria-pressed={scaleMode === "auto"} onClick={() => setScaleMode("auto")} type="button">
            自動
          </button>
          <button aria-pressed={scaleMode === "linear"} onClick={() => setScaleMode("linear")} type="button">
            通常
          </button>
          <button
            aria-pressed={scaleMode === "log"}
            disabled={!canUseLogScale}
            onClick={() => setScaleMode("log")}
            type="button"
          >
            対数
          </button>
        </div>
        <span className={styles.scaleDescription}>{scaleDescription}</span>
      </div>

      <div aria-live="polite" className={styles.readout}>
        <strong>{formatSelectedTime(activeTimestamp, mode)}</strong>
        <div className={styles.readoutValues}>
          {selectedValues.map(({ line, point }) => (
            <span
              className={focusedProductId !== null && focusedProductId !== line.productId ? styles.readoutDimmed : undefined}
              key={line.productId}
            >
              <i aria-hidden="true" style={{ backgroundColor: line.color }} />
              {line.label}: {yen(point.price)}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.chartWrap}>
        <svg
          aria-label={`${seriesName}シリーズの${priceLabel}推移`}
          className={styles.svg}
          onPointerDown={selectByPointer}
          onPointerMove={selectByPointer}
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          {yTicks.map((value) => {
            const y = yAt(value);
            return (
              <g key={`y-${value}`}>
                <line className={styles.gridLine} x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} />
                <text className={styles.yLabel} x={LEFT - 10} y={y + 4}>{axisYen(value)}</text>
              </g>
            );
          })}

          {xTicks.map((timestamp, index) => (
            <text
              className={styles.xLabel}
              key={`x-${timestamp}`}
              textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}
              x={LEFT + (plotWidth * index) / (xTicks.length - 1)}
              y={HEIGHT - 14}
            >
              {formatTick(timestamp, timeSpan)}
            </text>
          ))}

          <line
            className={styles.selectionLine}
            x1={xAt(activeTimestamp)}
            x2={xAt(activeTimestamp)}
            y1={TOP}
            y2={TOP + plotHeight}
          />

          {parsedLines.map((line) => {
            const path = line.points
              .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(point.timestamp).toFixed(2)},${yAt(point.price).toFixed(2)}`)
              .join(" ");
            const last = line.points.at(-1);
            const selectedPoint = pointAtOrBefore(line, activeTimestamp);
            const dimmed = focusedProductId !== null && focusedProductId !== line.productId;
            const focused = focusedProductId === line.productId;
            return (
              <g key={line.productId}>
                <path
                  className={styles.hitLine}
                  d={path}
                  onClick={() => setSelectedProductId((current) => current === line.productId ? null : line.productId)}
                  onPointerEnter={() => setHoveredProductId(line.productId)}
                  onPointerLeave={() => setHoveredProductId(null)}
                />
                <path
                  className={`${styles.seriesLine}${focused ? ` ${styles.focusedLine}` : ""}`}
                  d={path}
                  opacity={dimmed ? 0.12 : 1}
                  stroke={line.color}
                >
                  <title>{`${line.label} 現在${priceLabel} ${yen(line.currentPrice)}`}</title>
                </path>
                {last ? (
                  <circle
                    className={styles.endPoint}
                    cx={xAt(last.timestamp)}
                    cy={yAt(last.price)}
                    opacity={dimmed ? 0.12 : 1}
                    r={focused ? 4.5 : 3.2}
                    stroke={line.color}
                  />
                ) : null}
                {selectedPoint ? (
                  <circle
                    className={styles.selectedPoint}
                    cx={xAt(activeTimestamp)}
                    cy={yAt(selectedPoint.price)}
                    opacity={dimmed ? 0.12 : 1}
                    r={focused ? 5 : 3.5}
                    stroke={line.color}
                  >
                    <title>{`${line.label} ${priceLabel} ${yen(selectedPoint.price)}`}</title>
                  </circle>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <p className={styles.legendHint}>
        商品名にカーソルを合わせると該当線を強調。商品名を押すとその商品詳細へ移動します。
      </p>
      <div className={styles.legend} aria-label={`${seriesName}シリーズの作品一覧`}>
        {parsedLines.map((line) => {
          const dimmed = focusedProductId !== null && focusedProductId !== line.productId;
          return (
            <Link
              className={dimmed ? styles.legendDimmed : undefined}
              href={`/products/${line.productId}`}
              key={line.productId}
              onPointerEnter={() => setHoveredProductId(line.productId)}
              onPointerLeave={() => setHoveredProductId(null)}
              title={`${line.label}の商品詳細を開く`}
            >
              <i aria-hidden="true" style={{ backgroundColor: line.color }} />
              <b>{line.label}</b>
              <em>{yen(line.currentPrice)}</em>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
