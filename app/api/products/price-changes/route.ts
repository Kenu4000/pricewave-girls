import { NextResponse } from "next/server";
import {
  buildProductCardPriceChangeSummaries,
  classifySaleAvailabilityState,
  hasCurrentOtherShopInventory,
} from "@/lib/product-card-price-change";
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

  const [changes, products] = await Promise.all([
    prisma.priceChange.findMany({
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
    }),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        stockStatus: true,
        histories: {
          orderBy: { checkedAt: "desc" },
          take: 1,
          select: { checkedAt: true },
        },
        junkHistories: {
          orderBy: { checkedAt: "desc" },
          take: 100,
          select: {
            sourceType: true,
            checkedAt: true,
          },
        },
      },
    }),
  ]);

  const summaries = buildProductCardPriceChangeSummaries(changes);
  for (const product of products) {
    const saleChange = summaries[product.id]?.sale;
    if (!saleChange) continue;

    const latestSnapshotAt = product.histories[0]?.checkedAt ?? null;
    const hasOtherShopInventory = hasCurrentOtherShopInventory(
      latestSnapshotAt,
      product.junkHistories,
    );
    saleChange.availabilityState = classifySaleAvailabilityState(
      saleChange,
      product.stockStatus,
      hasOtherShopInventory,
    );
  }

  return NextResponse.json({ summaries });
}
