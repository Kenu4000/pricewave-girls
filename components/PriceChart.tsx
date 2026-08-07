"use client";

import { useMemo, useState } from "react";
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

export function PriceChart({ histories }: { histories: PriceChartHistory[] }) {
  const [mode, setMode] = useState<PriceChartMode>("day");
  const data = useMemo(() => aggregatePriceChartData(histories, mode), [histories, mode]);

  if (histories.length === 0) {
    return <p className="muted">まだ価格履歴がありません。</p>;
  }

  return (
    <>
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
      <div className="chart-wrap">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ bottom: 8, left: 0, right: 18, top: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" minTickGap={24} />
            <YAxis tickFormatter={(value) => yenFormatter(value)} width={92} />
            <Tooltip formatter={(value) => yenFormatter(value as number | string | null)} />
            <Legend />
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
              name="販売価格"
              stroke="#d9469a"
              strokeWidth={3}
              type="monotone"
            />
            <Line
              connectNulls
              dataKey="buyPrice"
              name="買取価格"
              stroke="#3b82f6"
              strokeWidth={3}
              type="monotone"
            />
            <Line
              connectNulls
              dataKey="rankBPrice"
              name="ランクB"
              stroke="#16a34a"
              strokeWidth={3}
              type="monotone"
            />
            <Line
              connectNulls={false}
              dataKey="timeSalePrice"
              dot={{ r: 4 }}
              name="タイムセール"
              stroke="#eab308"
              strokeWidth={3}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
