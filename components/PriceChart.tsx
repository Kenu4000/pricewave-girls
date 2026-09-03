"use client";

import { useMemo, useState } from "react";
import {
  aggregatePriceChartData,
  type AggregatedPriceChartPoint,
  type PriceChartHistory,
  type PriceChartMode,
} from "@/lib/price-chart-data";
import styles from "./PriceChart.module.css";

const PERIOD_OPTIONS: Array<{ value: PriceChartMode; label: string }> = [
  { value: "day", label: "日（全期間）" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
];

const SERIES = [
  { key: "salePrice", name: "販売価格", color: "#d9469a" },
  { key: "buyPrice", name: "買取価格", color: "#3b82f6" },
  { key: "rankBPrice", name: "ランクB", color: "#16a34a" },
  { key: "timeSalePrice", name: "タイムセール", color: "#eab308" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const WIDTH = 960;
const HEIGHT = 300;
const LEFT = 72;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 46;

function yen(value: number | null | undefined): string {
  return value == null ? "-" : `${value.toLocaleString("ja-JP")}円`;
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

function seriesValue(point: AggregatedPriceChartPoint, key: SeriesKey): number | null {
  return point[key];
}

function linePath(
  data: AggregatedPriceChartPoint[],
  key: SeriesKey,
  xAt: (index: number) => number,
  yAt: (value: number) => number,
): string {
  const parts: string[] = [];
  let started = false;
  for (let index = 0; index < data.length; index += 1) {
    const value = seriesValue(data[index], key);
    if (value == null) continue;
    parts.push(`${started ? "L" : "M"}${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`);
    started = true;
  }
  return parts.join(" ");
}

function tickIndices(length: number, maximum = 6): number[] {
  if (length <= maximum) return Array.from({ length }, (_, index) => index);
  const result = new Set<number>([0, length - 1]);
  for (let index = 1; index < maximum - 1; index += 1) {
    result.add(Math.round((index * (length - 1)) / (maximum - 1)));
  }
  return [...result].sort((left, right) => left - right);
}

export function PriceChart({ histories }: { histories: PriceChartHistory[] }) {
  const [mode, setMode] = useState<PriceChartMode>("day");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const data = useMemo(() => aggregatePriceChartData(histories, mode), [histories, mode]);

  const selectedIndex = selectedKey
    ? data.findIndex((point) => point.key === selectedKey)
    : data.length - 1;
  const safeSelectedIndex = selectedIndex >= 0 ? selectedIndex : data.length - 1;
  const selectedPoint = data[safeSelectedIndex] ?? null;

  const values = data.flatMap((point) => [
    point.salePrice,
    point.buyPrice,
    point.rankBPrice,
    point.timeSalePrice,
    point.timeSaleBasePrice,
  ]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (histories.length === 0 || data.length === 0 || values.length === 0) {
    return <p className="muted">まだ価格履歴がありません。</p>;
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(1, rawMax - rawMin);
  const padding = Math.max(100, span * 0.08);
  const minValue = Math.max(0, rawMin - padding);
  const maxValue = rawMax + padding;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const xAt = (index: number) =>
    data.length <= 1 ? LEFT + plotWidth / 2 : LEFT + (index / (data.length - 1)) * plotWidth;
  const yAt = (value: number) => TOP + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) => minValue + ((maxValue - minValue) * index) / 4);
  const xTicks = tickIndices(data.length);

  const selectPoint = (point: AggregatedPriceChartPoint) => setSelectedKey(point.key);

  return (
    <div className={styles.root}>
      <div aria-label="価格推移の表示単位" className={styles.controls}>
        {PERIOD_OPTIONS.map((option) => (
          <button
            aria-pressed={mode === option.value}
            className={styles.periodButton}
            key={option.value}
            onClick={() => {
              setMode(option.value);
              setSelectedKey(null);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className={styles.note}>
        {mode === "day"
          ? "全期間を取得時刻ごとに表示。黄色は通常価格から一時的に分岐したタイムセール価格"
          : mode === "week"
            ? "全期間を週ごとの最終価格で表示"
            : "全期間を月ごとの最終価格で表示"}
      </p>

      {selectedPoint ? (
        <div aria-live="polite" className={styles.readout}>
          <strong>{selectedPoint.label}</strong>
          <div className={styles.readoutValues}>
            {SERIES.map((series) => (
              <span key={series.key}>
                <i aria-hidden="true" style={{ backgroundColor: series.color }} />
                {series.name}: {yen(seriesValue(selectedPoint, series.key))}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.chartWrap}>
        <svg
          aria-label="価格推移グラフ"
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

          {xTicks.map((index) => (
            <text
              className={styles.xLabel}
              key={`x-${data[index].key}`}
              textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
              x={xAt(index)}
              y={HEIGHT - 14}
            >
              {data[index].label}
            </text>
          ))}

          {SERIES.filter((series) => series.key !== "timeSalePrice").map((series) => {
            const path = linePath(data, series.key, xAt, yAt);
            return path ? (
              <path
                className={styles.seriesLine}
                d={path}
                key={series.key}
                stroke={series.color}
              />
            ) : null;
          })}

          {data.map((point, index) => {
            if (point.timeSalePrice == null || point.timeSaleBasePrice == null) return null;
            return (
              <line
                className={styles.timeSaleBranch}
                key={`sale-branch-${point.key}`}
                x1={xAt(index)}
                x2={xAt(index)}
                y1={yAt(point.timeSaleBasePrice)}
                y2={yAt(point.timeSalePrice)}
              />
            );
          })}

          {SERIES.map((series) =>
            data.map((point, index) => {
              const value = seriesValue(point, series.key);
              if (value == null) return null;
              const selected = index === safeSelectedIndex;
              return (
                <circle
                  aria-label={`${point.label} ${series.name} ${yen(value)}`}
                  className={styles.point}
                  cx={xAt(index)}
                  cy={yAt(value)}
                  key={`${series.key}-${point.key}`}
                  onFocus={() => selectPoint(point)}
                  onPointerDown={() => selectPoint(point)}
                  onPointerEnter={() => selectPoint(point)}
                  r={selected ? 5 : series.key === "timeSalePrice" ? 4 : 3}
                  role="button"
                  stroke={series.color}
                  tabIndex={0}
                />
              );
            }),
          )}
        </svg>
      </div>

      <div className={styles.legend} aria-label="価格系列">
        {SERIES.map((series) => (
          <span key={series.key}><i aria-hidden="true" style={{ backgroundColor: series.color }} />{series.name}</span>
        ))}
      </div>
    </div>
  );
}
