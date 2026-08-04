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
  const detailsJson =
    Object.keys(fetched.details).length > 0 ? JSON.stringify(fetched.details) : null;
  const details = {
    managementNumber: fetched.managementNumber,
    manufacturer: fetched.manufacturer,
    releaseDate: fetched.releaseDate,
    listPrice: fetched.listPrice,
    modelNumber: fetched.modelNumber,
    category: fetched.category,
    detailsJson,
  };

  const detailUpdates = {
    ...(fetched.managementNumber !== null
      ? { managementNumber: fetched.managementNumber }
      : {}),
    ...(fetched.manufacturer !== null ? { manufacturer: fetched.manufacturer } : {}),
    ...(fetched.releaseDate !== null ? { releaseDate: fetched.releaseDate } : {}),
    ...(fetched.listPrice !== null ? { listPrice: fetched.listPrice } : {}),
    ...(fetched.modelNumber !== null ? { modelNumber: fetched.modelNumber } : {}),
    ...(fetched.category !== null ? { category: fetched.category } : {}),
    ...(detailsJson !== null ? { detailsJson } : {}),
  };

  return prisma.product.upsert({
    where: { surugayaUrl },
    update: {
      title: fetched.title,
      imageUrl: fetched.imageUrl,
      latestSalePrice: fetched.salePrice,
      latestBuyPrice: fetched.buyPrice,
      stockStatus: fetched.stockStatus,
      ...detailUpdates,
      histories: { create: snapshot },
    },
    create: {
      title: fetched.title,
      surugayaUrl,
      imageUrl: fetched.imageUrl,
      latestSalePrice: fetched.salePrice,
      latestBuyPrice: fetched.buyPrice,
      stockStatus: fetched.stockStatus,
      ...details,
      histories: { create: snapshot },
    },
  });
}
