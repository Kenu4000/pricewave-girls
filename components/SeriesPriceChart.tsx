"use client";

import { useMemo, useState } from "react";
import styles from "./SeriesPriceChart.module.css";

export type SeriesPriceHistoryPoint = {
  checkedAt: string;
  salePrice: number | null;
};

export type SeriesPriceLine = {
  title: string;
  histories: SeriesPriceHistoryPoint[];
};

type ParsedPoint = {
  checkedAt: string;
  timestamp: number;
  salePrice: number;
};

type ParsedLine = {
  title: string;
  points: ParsedPoint[];
  currentPrice: number | null;
  color: string;
};

type ScaleMode = "auto" | "linear" | "log";

const WIDTH = 960;
const HEIGHT = 340;
const LEFT = 72;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 46;
const AUTO_LOG_RATIO = 8;

function yen(value: number | null): string {
  return value == null ? "未取得" : `${value.toLocaleString("ja-JP")}円`;
}

function compactYen(value: number): string {
  if (Math.abs(value) >= 10_000) {
    const man = value / 10_000;
    return `${Number.isInteger(man) ? man.toFixed(0) : man.toFixed(1)}万`;
  }
  if (Math.abs(value) >= 1_000) {
    const thousand = value / 1_000;
    return `${Number.isInteger(thousand) ? thousand.toFixed(0) : thousand.toFixed(1)}千`;
  }
  return String(Math.round(value));
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

function parseLines(lines: SeriesPriceLine[]): ParsedLine[] {
  return lines.flatMap((line, index) => {
    const points = line.histories
      .flatMap((history) => {
        if (history.salePrice == null || !Number.isFinite(history.salePrice)) return [];
        const timestamp = new Date(history.checkedAt).getTime();
        if (!Number.isFinite(timestamp)) return [];
        return [{ checkedAt: history.checkedAt, timestamp, salePrice: history.salePrice }];
      })
      .sort((left, right) => left.timestamp - right.timestamp);
    if (points.length === 0) return [];
    return [{
      title: line.title,
      points,
      currentPrice: points.at(-1)?.salePrice ?? null,
      color: lineColor(index),
    }];
  });
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
  const [scaleMode, setScaleMode] = useState<ScaleMode>("auto");
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);
  const parsedLines = useMemo(() => parseLines(lines), [lines]);
  const allPoints = parsedLines.flatMap((line) => line.points);

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
        <button className={styles.toggleButton} onClick={() => setOpen(false)} type="button">
          シリーズを閉じる
        </button>
        <p className="muted">このシリーズで表示できる価格履歴がありません。</p>
      </div>
    );
  }

  const timestamps = allPoints.map((point) => point.timestamp);
  const prices = allPoints.map((point) => point.salePrice);
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
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
  const focusedTitle = selectedTitle ?? hoveredTitle;
  const scaleDescription = useLogScale
    ? scaleMode === "auto"
      ? "価格差が大きいため、自動で対数目盛にして低価格帯も見えるようにしています。"
      : "対数目盛で価格差の大きい作品も同じグラフで見やすくしています。"
    : "通常の金額差で表示しています。";

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div>
          <strong>{seriesName}</strong>
          <span className={styles.count}>
            価格履歴あり {parsedLines.length.toLocaleString("ja-JP")} / 定義 {definedTitleCount.toLocaleString("ja-JP")}作品
          </span>
        </div>
        <button className={styles.toggleButton} onClick={() => setOpen(false)} type="button">
          シリーズを閉じる
        </button>
      </div>

      <p className={styles.note}>シリーズ内の各作品について、販売価格の推移を1本ずつ重ねて表示</p>

      <div className={styles.scaleToolbar}>
        <span>縦軸</span>
        <div aria-label="シリーズ価格グラフの縦軸" className={styles.scaleButtons}>
          <button
            aria-pressed={scaleMode === "auto"}
            onClick={() => setScaleMode("auto")}
            type="button"
          >
            自動
          </button>
          <button
            aria-pressed={scaleMode === "linear"}
            onClick={() => setScaleMode("linear")}
            type="button"
          >
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

      <div className={styles.chartWrap}>
        <svg
          aria-label={`${seriesName}シリーズの販売価格推移`}
          className={styles.svg}
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          {yTicks.map((value) => {
            const y = yAt(value);
            return (
              <g key={`y-${value}`}>
                <line className={styles.gridLine} x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} />
                <text className={styles.yLabel} x={LEFT - 10} y={y + 4}>{compactYen(value)}</text>
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

          {parsedLines.map((line) => {
            const path = line.points
              .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(point.timestamp).toFixed(2)},${yAt(point.salePrice).toFixed(2)}`)
              .join(" ");
            const last = line.points.at(-1);
            const dimmed = focusedTitle !== null && focusedTitle !== line.title;
            const focused = focusedTitle === line.title;
            return (
              <g key={line.title}>
                <path
                  className={styles.hitLine}
                  d={path}
                  onClick={() => setSelectedTitle((current) => current === line.title ? null : line.title)}
                  onPointerEnter={() => setHoveredTitle(line.title)}
                  onPointerLeave={() => setHoveredTitle(null)}
                />
                <path
                  className={`${styles.seriesLine}${focused ? ` ${styles.focusedLine}` : ""}`}
                  d={path}
                  opacity={dimmed ? 0.12 : 1}
                  stroke={line.color}
                >
                  <title>{`${line.title} 現在 ${yen(line.currentPrice)}`}</title>
                </path>
                {last ? (
                  <circle
                    className={styles.endPoint}
                    cx={xAt(last.timestamp)}
                    cy={yAt(last.salePrice)}
                    opacity={dimmed ? 0.12 : 1}
                    r={focused ? 4.5 : 3.2}
                    stroke={line.color}
                  >
                    <title>{`${line.title} ${new Date(last.checkedAt).toLocaleString("ja-JP")} ${yen(last.salePrice)}`}</title>
                  </circle>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <p className={styles.legendHint}>作品名にカーソルを合わせるとその線を強調。クリックすると固定できます。</p>
      <div className={styles.legend} aria-label={`${seriesName}シリーズの作品一覧`}>
        {parsedLines.map((line) => {
          const dimmed = focusedTitle !== null && focusedTitle !== line.title;
          return (
            <button
              aria-pressed={selectedTitle === line.title}
              className={dimmed ? styles.legendDimmed : undefined}
              key={line.title}
              onClick={() => setSelectedTitle((current) => current === line.title ? null : line.title)}
              onPointerEnter={() => setHoveredTitle(line.title)}
              onPointerLeave={() => setHoveredTitle(null)}
              title={line.title}
              type="button"
            >
              <i aria-hidden="true" style={{ backgroundColor: line.color }} />
              <b>{line.title}</b>
              <em>{yen(line.currentPrice)}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}
