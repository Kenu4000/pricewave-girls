import { NextResponse } from "next/server";
import { rankFeaturedBrandsByCrawlFrequency } from "@/lib/brand-featured-crawl-order";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    select: {
      manufacturer: true,
      crawlIntervalDays: true,
    },
  });

  const featured = rankFeaturedBrandsByCrawlFrequency(products).map((profile) => ({
    value: profile.value,
    label: profile.label,
    total: profile.total,
    daily: profile.daily,
    withinThreeDays: profile.withinThreeDays,
    withinSevenDays: profile.withinSevenDays,
    active: profile.active,
  }));

  return NextResponse.json({ featured });
}
