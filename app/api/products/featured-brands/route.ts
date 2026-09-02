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

  const featured = selectFeaturedBrands(products).map((profile) => ({
    value: profile.value,
    label: profile.label,
    total: profile.total,
    daily: profile.daily,
    withinThreeDays: profile.withinThreeDays,
    withinSevenDays: profile.withinSevenDays,
    active: profile.active,
  }));
  const byProductCount = rankFeaturedBrandsByCrawlFrequency(products, 1)
    .sort(
      (left, right) =>
        right.total - left.total || japaneseCollator.compare(left.label, right.label),
    )
    .map((profile) => ({
      value: profile.value,
      label: profile.label,
      total: profile.total,
    }));

  return NextResponse.json({ featured, byProductCount });
}
