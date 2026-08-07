export type PriceChartMode = "day" | "week" | "month";

export type PriceChartHistory = {
  checkedAt: string;
  salePrice: number | null;
  regularSalePrice?: number | null;
  buyPrice: number | null;
  condition?: string | null;
  conditionRank?: string | null;
  isTimeSale?: boolean;
};

export type AggregatedPriceChartPoint = {
  key: string;
  label: string;
  checkedAt: string;
  salePrice: number | null;
  buyPrice: number | null;
  rankBPrice: number | null;
  timeSalePrice: number | null;
  timeSaleBasePrice: number | null;
  condition: string | null;
  conditionRank: string;
  isTimeSale: boolean;
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

  if (mode === "day") {
    const recent = valid.filter(
      (history) => history.date.getTime() >= dayThreshold.getTime(),
    );
    const pointsPerDay = new Map<string, number>();

    for (const history of recent) {
      const key = dateKey(history.date);
      pointsPerDay.set(key, (pointsPerDay.get(key) ?? 0) + 1);
    }

    return recent.map((history, index) => {
      const key = dateKey(history.date);
      return toChartPoint(
        history,
        `${history.checkedAt}-${index}`,
        dayPointLabel(history.date, (pointsPerDay.get(key) ?? 0) > 1),
      );
    });
  }

  const buckets = new Map<string, (typeof valid)[number]>();
  for (const history of valid) {
    buckets.set(bucketKey(history.date, mode), history);
  }

  return [...buckets.entries()].map(([key, history]) =>
    toChartPoint(history, key, bucketLabel(history.date, mode)),
  );
}

function toChartPoint(
  history: PriceChartHistory & { date: Date },
  key: string,
  label: string,
): AggregatedPriceChartPoint {
  const isTimeSale = history.isTimeSale === true;
  const conditionRank = history.conditionRank === "B" || history.condition ? "B" : "A";
  const baseSalePrice = isTimeSale
    ? (history.regularSalePrice ?? history.salePrice)
    : history.salePrice;

  return {
    key,
    label,
    checkedAt: history.checkedAt,
    salePrice: conditionRank === "B" ? null : baseSalePrice,
    buyPrice: history.buyPrice,
    rankBPrice: conditionRank === "B" ? baseSalePrice : null,
    timeSalePrice: isTimeSale ? history.salePrice : null,
    timeSaleBasePrice: isTimeSale ? baseSalePrice : null,
    condition: history.condition ?? null,
    conditionRank,
    isTimeSale,
  };
}

function bucketKey(date: Date, mode: Exclude<PriceChartMode, "day">): string {
  if (mode === "month") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

  const monday = startOfWeek(date);
  return dateKey(monday);
}

function bucketLabel(date: Date, mode: Exclude<PriceChartMode, "day">): string {
  if (mode === "month") {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short" }).format(date);
  }

  const monday = startOfWeek(date);
  return `${new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(monday)}週`;
}

function dayPointLabel(date: Date, includeTime: boolean): string {
  return new Intl.DateTimeFormat(
    "ja-JP",
    includeTime
      ? {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      : { month: "numeric", day: "numeric" },
  ).format(date);
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
