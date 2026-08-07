import { NextResponse } from "next/server";
import { buildProductCardPriceChangeSummaries } from "@/lib/product-card-price-change";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PRODUCT_IDS = 100;

function parseProductIds(request: Request): number[] {
  const { searchParams } = new URL(request.url);
  const ids = searchParams
    .get("ids")
    ?.split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0) ?? [];

  return [...new Set(ids)].slice(0, MAX_PRODUCT_IDS);
}

export async function GET(request: Request) {
  const productIds = parseProductIds(request);
  if (productIds.length === 0) {
    return NextResponse.json({ summaries: {} });
  }

  const changes = await prisma.priceChange.findMany({
    where: {
      productId: { in: productIds },
      type: { in: ["sale", "buy"] },
    },
    orderBy: { changedAt: "desc" },
    distinct: ["productId", "type"],
    select: {
      productId: true,
      type: true,
      previousPrice: true,
      currentPrice: true,
      changedAt: true,
    },
  });

  return NextResponse.json({
    summaries: buildProductCardPriceChangeSummaries(changes),
  });
}
