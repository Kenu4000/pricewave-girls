export type PriceChartMode = "day" | "week" | "month";

export type PriceChartHistory = {
  checkedAt: string;
  salePrice: number | null;
  buyPrice: number | null;
};

export type AggregatedPriceChartPoint = PriceChartHistory & {
  key: string;
  label: string;
};

const DAY_RANGE_DAYS = 31;

export function aggregatePriceChartData(
  histories: PriceChartHistory[],
  mode: PriceChartMode,
): AggregatedPriceChartPoint[] {
  const valid = histories
    .map((history) => ({ ...history, date: new Date(history.checkedAt) }))
    .filter((history) => !Number.isNaN(history.date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (valid.length === 0) return [];

  const latest = valid.at(-1)!.date;
  const dayThreshold = new Date(latest);
  dayThreshold.setHours(0, 0, 0, 0);
  dayThreshold.setDate(dayThreshold.getDate() - (DAY_RANGE_DAYS - 1));

  const buckets = new Map<string, (typeof valid)[number]>();
  for (const history of valid) {
    if (mode === "day" && history.date.getTime() < dayThreshold.getTime()) continue;
    buckets.set(bucketKey(history.date, mode), history);
  }

  return [...buckets.entries()].map(([key, history]) => ({
    key,
    checkedAt: history.checkedAt,
    salePrice: history.salePrice,
    buyPrice: history.buyPrice,
    label: bucketLabel(history.date, mode),
  }));
}

function bucketKey(date: Date, mode: PriceChartMode): string {
  if (mode === "day") return dateKey(date);
  if (mode === "month") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

  const monday = startOfWeek(date);
  return dateKey(monday);
}

function bucketLabel(date: Date, mode: PriceChartMode): string {
  if (mode === "day") {
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date);
  }
  if (mode === "month") {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short" }).format(date);
  }

  const monday = startOfWeek(date);
  return `${new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(monday)}週`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
