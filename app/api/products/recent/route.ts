import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProductPreview } from "@/lib/product-preview";
import { RECENTLY_VIEWED_LIMIT } from "@/lib/recently-viewed";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = [...new Set(
    (url.searchParams.get("ids") ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )].slice(0, RECENTLY_VIEWED_LIMIT);

  if (ids.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { histories: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  const previews: ProductPreview[] = ids.flatMap((id) => {
    const product = byId.get(id);
    if (!product) return [];

    const priceChangedAt = [product.salePriceChangedAt, product.buyPriceChangedAt]
      .filter((value): value is Date => value !== null)
      .sort((left, right) => right.getTime() - left.getTime())[0]
      ?.toISOString() ?? null;

    return [{
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      salePrice: product.latestSalePrice,
      buyPrice: product.latestBuyPrice,
      priceChangedAt,
      manufacturer: product.manufacturer,
      releaseDate: product.releaseDate,
      modelNumber: product.modelNumber,
      stockStatus: product.stockStatus,
      condition: product.condition,
      conditionRank: product.conditionRank,
      hasHistory: product.histories.length > 0,
      isNew: false,
    }];
  });

  return NextResponse.json({ products: previews });
}
