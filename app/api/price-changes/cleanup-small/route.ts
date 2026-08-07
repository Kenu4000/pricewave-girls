import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  isSmallPriceChange,
  SMALL_PRICE_CHANGE_THRESHOLD,
} from "@/lib/price-change-cleanup";
import { notifyProductsChanged } from "@/lib/product-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DELETE_CHUNK_SIZE = 500;
const PRODUCT_UPDATE_CHUNK_SIZE = 500;

export async function DELETE() {
  const deletedCount = await prisma.$transaction(async (transaction) => {
    const candidates = await transaction.priceChange.findMany({
      where: {
        previousPrice: { not: null },
        currentPrice: { not: null },
      },
      select: {
        id: true,
        productId: true,
        previousPrice: true,
        currentPrice: true,
      },
    });
    const targets = candidates.filter((change) =>
      isSmallPriceChange(change.previousPrice, change.currentPrice),
    );

    if (targets.length === 0) return 0;

    for (let start = 0; start < targets.length; start += DELETE_CHUNK_SIZE) {
      const ids = targets
        .slice(start, start + DELETE_CHUNK_SIZE)
        .map((change) => change.id);
      await transaction.priceChange.deleteMany({ where: { id: { in: ids } } });
    }

    const productIds = [...new Set(targets.map((change) => change.productId))];
    for (
      let start = 0;
      start < productIds.length;
      start += PRODUCT_UPDATE_CHUNK_SIZE
    ) {
      const ids = productIds.slice(start, start + PRODUCT_UPDATE_CHUNK_SIZE);
      await transaction.$executeRaw(Prisma.sql`
        UPDATE "Product"
        SET
          "salePriceChangedAt" = (
            SELECT MAX("changedAt")
            FROM "PriceChange"
            WHERE
              "PriceChange"."productId" = "Product"."id"
              AND "PriceChange"."type" = 'sale'
          ),
          "buyPriceChangedAt" = (
            SELECT MAX("changedAt")
            FROM "PriceChange"
            WHERE
              "PriceChange"."productId" = "Product"."id"
              AND "PriceChange"."type" = 'buy'
          )
        WHERE "Product"."id" IN (${Prisma.join(ids)})
      `);
    }

    return targets.length;
  });

  if (deletedCount > 0) notifyProductsChanged();

  return NextResponse.json({
    ok: true,
    deletedCount,
    threshold: SMALL_PRICE_CHANGE_THRESHOLD,
  });
}
