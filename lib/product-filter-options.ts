import { resolveBrandIdentity } from "@/lib/brand-aliases";

export type FilterSourceProduct = {
  id: number;
  manufacturer: string | null;
  releaseDate: string | null;
  category: string | null;
  detailsJson: string | null;
};

export type FilterOption = {
  value: string;
  label: string;
  count: number;
};

export type RankedFilterOptions = {
  featured: FilterOption[];
  alphabetical: FilterOption[];
};

type FilterOptionIndex = {
  options: RankedFilterOptions;
  productIds: Map<string, number[]>;
};

export type ProductFilterCatalog = {
  brands: FilterOptionIndex;
  operatingSystems: FilterOptionIndex;
  illustrators: FilterOptionIndex;
  scenarios: FilterOptionIndex;
  voiceActors: FilterOptionIndex;
  releaseYears: string[];
  detailProductIds: Map<string, number[]>;
};

export type PriceBand = {
  value: string;
  label: string;
  min?: number;
  max?: number;
  unknown?: true;
};

export const PRICE_BANDS: PriceBand[] = [
  { value: "under-1000", label: "999円以下", max: 999 },
  { value: "1000-2999", label: "1,000〜2,999円", min: 1_000, max: 2_999 },
  { value: "3000-4999", label: "3,000〜4,999円", min: 3_000, max: 4_999 },
  { value: "5000-9999", label: "5,000〜9,999円", min: 5_000, max: 9_999 },
  { value: "10000-19999", label: "10,000〜19,999円", min: 10_000, max: 19_999 },
  { value: "20000-plus", label: "20,000円以上", min: 20_000 },
  { value: "unknown", label: "未取得", unknown: true },
];

const FEATURED_OPTION_LIMIT = 12;
const japaneseCollator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});

const OS_ORDER = [
  "Windows 11",
  "Windows 10",
  "Windows 8.1",
  "Windows 8",
  "Windows 7",
  "Windows Vista",
  "Windows XP",
  "Windows 2000",
  "Windows Me",
  "Windows 98",
  "Windows 95",
  "Windows 3.1",
  "Windows",
  "macOS",
  "MS-DOS",
  "Linux",
  "PC-98",
] as const;

type Bucket = {
  labels: Map<string, number>;
  productIds: Set<number>;
};

function normalizeDisplayValue(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/^(?:ブランド|メーカー)\s*[:：]\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeChoiceKey(value: string): string {
  return normalizeDisplayValue(value)
    .toLocaleLowerCase("ja")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

export function normalizeFilterChoiceValue(value: string): string {
  return resolveBrandIdentity(value).key;
}

export function detailFilterValue(label: string, value: string): string {
  return `${normalizeChoiceKey(label)}\u0000${normalizeChoiceKey(value)}`;
}

function parseDetails(rawDetails: string | null): Record<string, string> {
  if (!rawDetails) return {};

  try {
    const parsed = JSON.parse(rawDetails) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && entry[1].trim().length > 0,
      ),
    );
  } catch {
    return {};
  }
}

function addBucketValue(
  buckets: Map<string, Bucket>,
  rawValue: string,
  productId: number,
  forcedKey?: string,
) {
  const label = normalizeDisplayValue(rawValue);
  if (!label) return;

  const key = forcedKey ?? normalizeChoiceKey(label);
  if (!key) return;

  const bucket = buckets.get(key) ?? {
    labels: new Map<string, number>(),
    productIds: new Set<number>(),
  };
  bucket.labels.set(label, (bucket.labels.get(label) ?? 0) + 1);
  bucket.productIds.add(productId);
  buckets.set(key, bucket);
}

function preferredLabel(labels: Map<string, number>): string {
  return [...labels.entries()].sort(
    ([leftLabel, leftCount], [rightLabel, rightCount]) =>
      rightCount - leftCount ||
      leftLabel.length - rightLabel.length ||
      japaneseCollator.compare(leftLabel, rightLabel),
  )[0]?.[0] ?? "";
}

function buildRankedIndex(
  buckets: Map<string, Bucket>,
  orderedValues?: readonly string[],
): FilterOptionIndex {
  const productIds = new Map<string, number[]>();
  const options = [...buckets.entries()].map(([value, bucket]) => {
    const ids = [...bucket.productIds];
    productIds.set(value, ids);
    return {
      value,
      label: preferredLabel(bucket.labels),
      count: ids.length,
    };
  });

  if (orderedValues) {
    const order = new Map(orderedValues.map((value, index) => [value, index]));
    options.sort(
      (left, right) =>
        (order.get(left.label) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(right.label) ?? Number.MAX_SAFE_INTEGER) ||
        japaneseCollator.compare(left.label, right.label),
    );
    return { options: { featured: [], alphabetical: options }, productIds };
  }

  const featured = options
    .filter((option) => option.count >= 2)
    .sort(
      (left, right) =>
        right.count - left.count || japaneseCollator.compare(left.label, right.label),
    )
    .slice(0, FEATURED_OPTION_LIMIT);
  const featuredValues = new Set(featured.map((option) => option.value));
  const alphabetical = options
    .filter((option) => !featuredValues.has(option.value))
    .sort((left, right) => japaneseCollator.compare(left.label, right.label));

  return { options: { featured, alphabetical }, productIds };
}

function detailValues(details: Record<string, string>, labels: readonly string[]): string[] {
  const normalizedLabels = new Set(labels.map((label) => normalizeChoiceKey(label)));
  return Object.entries(details).flatMap(([label, value]) =>
    normalizedLabels.has(normalizeChoiceKey(label)) ? [value] : [],
  );
}

export function splitDetailPeople(value: string): string[] {
  return value
    .split(/\s*(?:、|,|，|\/|／|;|；|\r?\n)\s*/u)
    .map(normalizeDisplayValue)
    .filter(Boolean);
}

export function extractOperatingSystems(...rawValues: Array<string | null | undefined>): string[] {
  const results = new Set<string>();

  for (const rawValue of rawValues) {
    if (!rawValue) continue;
    const value = rawValue.normalize("NFKC");
    const hasWindows = /\bwin(?:dows)?/iu.test(value);

    if (hasWindows) {
      const versionMatches = value.matchAll(
        /(?:11|10|8\.1|8|7|Vista|XP|2000|Me|98|95|3\.1)/giu,
      );
      let foundVersion = false;
      for (const match of versionMatches) {
        const rawVersion = match[0];
        const normalizedVersion = /vista/i.test(rawVersion)
          ? "Vista"
          : /^xp$/i.test(rawVersion)
            ? "XP"
            : /^me$/i.test(rawVersion)
              ? "Me"
              : rawVersion;
        results.add(`Windows ${normalizedVersion}`);
        foundVersion = true;
      }
      if (!foundVersion) results.add("Windows");
    }

    if (/mac\s*os|macos|os\s*x/iu.test(value)) results.add("macOS");
    if (/ms[-\s]?dos|dos\s*\/\s*v/iu.test(value)) results.add("MS-DOS");
    if (/linux/iu.test(value)) results.add("Linux");
    if (/pc[-\s]?98(?:01|21)?/iu.test(value)) results.add("PC-98");
  }

  return OS_ORDER.filter((operatingSystem) => results.has(operatingSystem));
}

export function buildProductFilterCatalog(
  products: FilterSourceProduct[],
): ProductFilterCatalog {
  const brands = new Map<string, Bucket>();
  const operatingSystems = new Map<string, Bucket>();
  const illustrators = new Map<string, Bucket>();
  const scenarios = new Map<string, Bucket>();
  const voiceActors = new Map<string, Bucket>();
  const releaseYears = new Set<string>();
  const detailProductIds = new Map<string, Set<number>>();

  for (const product of products) {
    const details = parseDetails(product.detailsJson);
    for (const [label, value] of Object.entries(details)) {
      const key = detailFilterValue(label, value);
      const productIds = detailProductIds.get(key) ?? new Set<number>();
      productIds.add(product.id);
      detailProductIds.set(key, productIds);
    }
    if (product.manufacturer) {
      const brand = resolveBrandIdentity(product.manufacturer);
      addBucketValue(brands, brand.label, product.id, brand.key);
    }

    const osDetails = detailValues(details, ["対応OS", "動作OS", "OS", "対応機種"]);
    for (const operatingSystem of extractOperatingSystems(product.category, ...osDetails)) {
      addBucketValue(operatingSystems, operatingSystem, product.id, operatingSystem);
    }

    for (const value of detailValues(details, ["原画", "原画家"])) {
      for (const person of splitDetailPeople(value)) {
        addBucketValue(illustrators, person, product.id);
      }
    }
    for (const value of detailValues(details, ["シナリオ", "脚本"])) {
      for (const person of splitDetailPeople(value)) addBucketValue(scenarios, person, product.id);
    }
    for (const value of detailValues(details, ["声優", "キャスト"])) {
      for (const person of splitDetailPeople(value)) addBucketValue(voiceActors, person, product.id);
    }

    const year = product.releaseDate?.match(/^(\d{4})-/u)?.[1];
    if (year) releaseYears.add(year);
  }

  return {
    brands: buildRankedIndex(brands),
    operatingSystems: buildRankedIndex(operatingSystems, OS_ORDER),
    illustrators: buildRankedIndex(illustrators),
    scenarios: buildRankedIndex(scenarios),
    voiceActors: buildRankedIndex(voiceActors),
    releaseYears: [...releaseYears].sort((left, right) => Number(right) - Number(left)),
    detailProductIds: new Map(
      [...detailProductIds].map(([key, productIds]) => [key, [...productIds]]),
    ),
  };
}

export function findPriceBand(value: string): PriceBand | undefined {
  return PRICE_BANDS.find((band) => band.value === value);
}
