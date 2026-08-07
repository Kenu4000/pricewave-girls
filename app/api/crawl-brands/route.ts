import { NextResponse } from "next/server";
import { resolveBrandIdentity } from "@/lib/brand-aliases";
import {
  isDailyCrawlBrand,
  productBrandCandidates,
} from "@/lib/crawl-brand-priority";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const japaneseCollator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});

export async function GET() {
  const products = await prisma.product.findMany({
    select: {
      manufacturer: true,
      detailsJson: true,
    },
  });

  const brands = new Map<string, { value: string; label: string; count: number }>();

  for (const product of products) {
    const matchedKeys = new Set<string>();
    for (const candidate of productBrandCandidates(
      product.manufacturer,
      product.detailsJson,
    )) {
      if (!isDailyCrawlBrand([candidate])) continue;

      const identity = resolveBrandIdentity(candidate);
      if (!identity.key || matchedKeys.has(identity.key)) continue;
      matchedKeys.add(identity.key);

      const current = brands.get(identity.key);
      brands.set(identity.key, {
        value: identity.key,
        label: identity.label,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  return NextResponse.json({
    brands: [...brands.values()].sort((left, right) =>
      japaneseCollator.compare(left.label, right.label),
    ),
  });
}
