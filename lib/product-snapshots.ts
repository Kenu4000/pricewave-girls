import { prisma } from "@/lib/prisma";
import type { FetchedProduct } from "@/lib/surugaya";

export async function upsertProductSnapshot(
  surugayaUrl: string,
  fetched: FetchedProduct,
) {
  const snapshot = {
    salePrice: fetched.salePrice,
    buyPrice: fetched.buyPrice,
    stockStatus: fetched.stockStatus,
  };

  return prisma.product.upsert({
    where: { surugayaUrl },
    update: {
      title: fetched.title,
      imageUrl: fetched.imageUrl,
      latestSalePrice: fetched.salePrice,
      latestBuyPrice: fetched.buyPrice,
      stockStatus: fetched.stockStatus,
      histories: { create: snapshot },
    },
    create: {
      title: fetched.title,
      surugayaUrl,
      imageUrl: fetched.imageUrl,
      latestSalePrice: fetched.salePrice,
      latestBuyPrice: fetched.buyPrice,
      stockStatus: fetched.stockStatus,
      histories: { create: snapshot },
    },
  });
}
