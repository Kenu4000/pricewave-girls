"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  aggregatePriceChartData,
  type PriceChartHistory,
  type PriceChartMode,
} from "@/lib/price-chart-data";
import { shouldPlaceTooltipAbove } from "@/lib/tooltip-position";
import styles from "./PriceChart.module.css";

const PERIOD_OPTIONS: Array<{ value: PriceChartMode; label: string }> = [
  { value: "day", label: "日（全期間）" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
];

const yenFormatter = (value: number | string | null) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value).toLocaleString("ja-JP")}円`;
};

const compactYenFormatter = (value: number | string | null) => {
  if (value === null || value === undefined) return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  if (Math.abs(amount) >= 10_000) {
    const man = amount / 10_000;
    return `${Number.isInteger(man) ? man.toFixed(0) : man.toFixed(1)}万`;
  }
  if (Math.abs(amount) >= 1_000) {
    const thousand = amount / 1_000;
    return `${Number.isInteger(thousand) ? thousand.toFixed(0) : thousand.toFixed(1)}千`;
  }
  return String(amount);
};

type TooltipPayloadEntry = {
  color?: string;
  name?: unknown;
  value?: unknown;
};

type PriceTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadEntry>;
  label?: unknown;
  rangeMidpoint: number | null;
};

function numericValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function PriceTooltip({ active, payload, label, rangeMidpoint }: PriceTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const rows = payload
    .map((entry) => ({
      color: entry.color,
      name: typeof entry.name === "string" ? entry.name : "価格",
      value: numericValue(entry.value),
    }))
    .filter((entry): entry is { color: string | undefined; name: string; value: number } =>
      entry.value !== null,
    );

  if (rows.length === 0) return null;

  const average = rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  const placeAbove = shouldPlaceTooltipAbove(average, rangeMidpoint);

  return (
    <div className={`${styles.tooltip} ${placeAbove ? styles.tooltipAbove : styles.tooltipBelow}`}>
      {label !== undefined && label !== null ? (
        <div className={styles.tooltipLabel}>{String(label)}</div>
      ) : null}
      <div className={styles.tooltipRows}>
        {rows.map((row, index) => (
          <div className={styles.tooltipRow} key={`${row.name}:${index}`}>
            <span
              aria-hidden="true"
              className={styles.tooltipMarker}
              style={{ backgroundColor: row.color ?? "currentColor" }}
            />
            <span>{row.name}</span>
            <strong>{yenFormatter(row.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PriceChart({ histories }: { histories: PriceChartHistory[] }) {
  const [mode, setMode] = useState<PriceChartMode>("day");
  const [compact, setCompact] = useState(false);
  const data = useMemo(() => aggregatePriceChartData(histories, mode), [histories, mode]);
  const tooltipRangeMidpoint = useMemo(() => {
    const values = data.flatMap((point) =>
      [point.salePrice, point.buyPrice, point.rankBPrice, point.timeSalePrice].filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      ),
    );
    if (values.length === 0) return null;
    return (Math.min(...values) + Math.max(...values)) / 2;
  }, [data]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const updateCompact = () => setCompact(media.matches);
    updateCompact();
    media.addEventListener("change", updateCompact);
    return () => media.removeEventListener("change", updateCompact);
  }, []);

  if (histories.length === 0) {
    return <p className="muted">まだ価格履歴がありません。</p>;
  }

  const chartMargin = compact
    ? { bottom: 2, left: -14, right: 2, top: 8 }
    : { bottom: 8, left: 0, right: 18, top: 16 };

  return (
    <div className={styles.root}>
      <div aria-label="価格推移の表示単位" className={styles.controls}>
        {PERIOD_OPTIONS.map((option) => (
          <button
            aria-pressed={mode === option.value}
            className={styles.periodButton}
            key={option.value}
            onClick={() => setMode(option.value)}
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
      <div className={styles.chartWrap}>
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              interval="preserveStartEnd"
              minTickGap={compact ? 12 : 24}
              tick={{ fontSize: compact ? 9 : 12 }}
              tickMargin={compact ? 5 : 8}
            />
            <YAxis
              tick={{ fontSize: compact ? 9 : 12 }}
              tickFormatter={(value) => (compact ? compactYenFormatter(value) : yenFormatter(value))}
              width={compact ? 58 : 92}
            />
            <Tooltip
              content={(props) => (
                <PriceTooltip
                  active={props.active}
                  label={props.label}
                  payload={props.payload}
                  rangeMidpoint={tooltipRangeMidpoint}
                />
              )}
            />
            <Legend
              iconSize={compact ? 8 : 14}
              wrapperStyle={{ fontSize: compact ? 10 : 12, lineHeight: compact ? "16px" : "20px" }}
            />
            {data
              .filter(
                (point) =>
                  point.timeSalePrice !== null &&
                  point.timeSaleBasePrice !== null &&
                  point.timeSalePrice !== point.timeSaleBasePrice,
              )
              .map((point) => (
                <ReferenceLine
                  key={`time-sale-branch-${point.key}`}
                  segment={[
                    { x: point.label, y: point.timeSaleBasePrice! },
                    { x: point.label, y: point.timeSalePrice! },
                  ]}
                  stroke="#eab308"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                />
              ))}
            <Line
              connectNulls
              dataKey="salePrice"
              dot={compact ? false : { r: 3 }}
              name="販売価格"
              stroke="#d9469a"
              strokeWidth={compact ? 2 : 3}
              type="monotone"
            />
            <Line
              connectNulls
              dataKey="buyPrice"
              dot={compact ? false : { r: 3 }}
              name="買取価格"
              stroke="#3b82f6"
              strokeWidth={compact ? 2 : 3}
              type="monotone"
            />
            <Line
              connectNulls
              dataKey="rankBPrice"
              dot={compact ? false : { r: 3 }}
              name="ランクB"
              stroke="#16a34a"
              strokeWidth={compact ? 2 : 3}
              type="monotone"
            />
            <Line
              connectNulls={false}
              dataKey="timeSalePrice"
              dot={{ r: compact ? 2.5 : 4 }}
              name="タイムセール"
              stroke="#eab308"
              strokeWidth={compact ? 2 : 3}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
