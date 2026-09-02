import { normalizeBrandKey, resolveBrandIdentity } from "@/lib/brand-aliases";

export type BrandCrawlSourceProduct = {
  manufacturer: string | null;
  crawlIntervalDays: number | null;
};

export type FeaturedBrandCrawlProfile = {
  value: string;
  label: string;
  total: number;
  daily: number;
  withinThreeDays: number;
  withinSevenDays: number;
  active: number;
};

export const FEATURED_BRAND_LIMIT = 20;

const FEATURED_EXCLUDED_SOURCE_KEYS = new Set(
  ["BEEP", "AiNO"].map((value) => normalizeBrandKey(value)),
);
const FEATURED_PINNED_BRANDS = ["暁", "あっぷりけ", "パープルソフトウェア", "Navel"] as const;

const japaneseCollator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});

function compareRatioDescending(
  leftNumerator: number,
  leftDenominator: number,
  rightNumerator: number,
  rightDenominator: number,
): number {
  return rightNumerator * leftDenominator - leftNumerator * rightDenominator;
}

function compareProfiles(
  left: FeaturedBrandCrawlProfile,
  right: FeaturedBrandCrawlProfile,
): number {
  return (
    compareRatioDescending(
      left.withinThreeDays,
      left.total,
      right.withinThreeDays,
      right.total,
    ) ||
    compareRatioDescending(left.daily, left.total, right.daily, right.total) ||
    compareRatioDescending(
      left.withinSevenDays,
      left.total,
      right.withinSevenDays,
      right.total,
    ) ||
    compareRatioDescending(left.active, left.total, right.active, right.total) ||
    right.total - left.total ||
    japaneseCollator.compare(left.label, right.label)
  );
}

export function rankFeaturedBrandsByCrawlFrequency(
  products: BrandCrawlSourceProduct[],
  minimumTotal = 2,
): FeaturedBrandCrawlProfile[] {
  const profiles = new Map<string, FeaturedBrandCrawlProfile>();

  for (const product of products) {
    if (!product.manufacturer) continue;
    const identity = resolveBrandIdentity(product.manufacturer);
    if (!identity.key) continue;

    const profile = profiles.get(identity.key) ?? {
      value: identity.key,
      label: identity.label,
      total: 0,
      daily: 0,
      withinThreeDays: 0,
      withinSevenDays: 0,
      active: 0,
    };

    profile.total += 1;
    if (product.crawlIntervalDays === 1) {
      profile.daily += 1;
      profile.withinThreeDays += 1;
      profile.withinSevenDays += 1;
      profile.active += 1;
    } else if (product.crawlIntervalDays === 3) {
      profile.withinThreeDays += 1;
      profile.withinSevenDays += 1;
      profile.active += 1;
    } else if (product.crawlIntervalDays === 7) {
      profile.withinSevenDays += 1;
      profile.active += 1;
    } else if (product.crawlIntervalDays === 14) {
      profile.active += 1;
    }

    profiles.set(identity.key, profile);
  }

  return [...profiles.values()]
    .filter((profile) => profile.total >= minimumTotal)
    .sort(compareProfiles);
}

export function selectFeaturedBrands(
  products: BrandCrawlSourceProduct[],
  limit = FEATURED_BRAND_LIMIT,
): FeaturedBrandCrawlProfile[] {
  const eligibleProducts = products.filter(
    (product) =>
      !product.manufacturer ||
      !FEATURED_EXCLUDED_SOURCE_KEYS.has(normalizeBrandKey(product.manufacturer)),
  );
  const allProfiles = rankFeaturedBrandsByCrawlFrequency(eligibleProducts, 1);
  const byValue = new Map(allProfiles.map((profile) => [profile.value, profile]));
  const pinned = FEATURED_PINNED_BRANDS.flatMap((brand) => {
    const profile = byValue.get(resolveBrandIdentity(brand).key);
    return profile ? [profile] : [];
  });
  const pinnedValues = new Set(pinned.map((profile) => profile.value));
  const ranked = allProfiles.filter(
    (profile) => profile.total >= 2 && !pinnedValues.has(profile.value),
  );

  return [...pinned, ...ranked].slice(0, Math.max(0, limit));
}
