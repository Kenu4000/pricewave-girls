import { NextResponse } from "next/server";
import {
  rankFeaturedBrandsByCrawlFrequency,
  selectFeaturedBrands,
} from "@/lib/brand-featured-crawl-order";
import { prisma } from "@/lib/prisma";

const japaneseCollator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});

export async function GET() {
  const products = await prisma.product.findMany({
    select: {
      manufacturer: true,
      crawlIntervalDays: true,
    },
  });

  const profiles = rankFeaturedBrandsByCrawlFrequency(products, 1);
  const stoppedValues = new Set(
    profiles.filter((profile) => profile.active === 0).map((profile) => profile.value),
  );

  const featured = selectFeaturedBrands(products)
    .filter((profile) => !stoppedValues.has(profile.value))
    .map((profile) => ({
      value: profile.value,
      label: profile.label,
      total: profile.total,
      daily: profile.daily,
      withinThreeDays: profile.withinThreeDays,
      withinSevenDays: profile.withinSevenDays,
      active: profile.active,
    }));
  const byProductCount = profiles
    .filter((profile) => profile.active > 0)
    .sort(
      (left, right) =>
        right.total - left.total || japaneseCollator.compare(left.label, right.label),
    )
    .map((profile) => ({
      value: profile.value,
      label: profile.label,
      total: profile.total,
    }));
  const stopped = profiles
    .filter((profile) => profile.active === 0)
    .sort((left, right) => japaneseCollator.compare(left.label, right.label))
    .map((profile) => ({
      value: profile.value,
      label: profile.label,
      total: profile.total,
    }));

  return NextResponse.json({ featured, byProductCount, stopped });
}
