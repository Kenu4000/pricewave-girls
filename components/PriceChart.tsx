"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  checkedAt: string;
  salePrice: number | null;
  buyPrice: number | null;
};

const yenFormatter = (value: number | string | null) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value).toLocaleString("ja-JP")}円`;
};

export function PriceChart({ histories }: { histories: ChartPoint[] }) {
  const data = histories.map((history) => ({
    ...history,
    label: new Date(history.checkedAt).toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  if (data.length === 0) {
    return <p className="muted">まだ価格履歴がありません。</p>;
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data} margin={{ bottom: 8, left: 0, right: 18, top: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={24} />
          <YAxis tickFormatter={(value) => yenFormatter(value)} width={92} />
          <Tooltip formatter={(value) => yenFormatter(value as number | string | null)} />
          <Legend />
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
