import { prisma } from "@/lib/prisma";
import { notifyProductsChanged } from "@/lib/product-events";
import type { FetchedProduct } from "@/lib/surugaya";
import { Prisma, type PrismaPromise } from "@prisma/client";

export type ProductSnapshotInput = {
  surugayaUrl: string;
  fetched: FetchedProduct;
};

// Prisma's bundled SQLite supports enough bind variables for 1,000 rows here.
// One multi-row UPSERT plus one history INSERT keeps a 1,000-item import to two
// SQL statements while the surrounding transaction preserves atomicity.
const RAW_SQL_CHUNK_SIZE = 1_000;

type StoredProductSnapshot = {
  id: number;
  surugayaUrl: string;
  title: string;
  imageUrl: string | null;
  manufacturer: string | null;
  releaseDate: string | null;
  modelNumber: string | null;
  latestSalePrice: number | null;
  latestBuyPrice: number | null;
  stockStatus: string | null;
};

function buildProductUpsertArgs(
  surugayaUrl: string,
  fetched: FetchedProduct,
): Prisma.ProductUpsertArgs {
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

  return {
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
    select: { id: true },
  };
}

export async function upsertProductSnapshot(
  surugayaUrl: string,
  fetched: FetchedProduct,
) {
  const product = await prisma.product.upsert(buildProductUpsertArgs(surugayaUrl, fetched));

  notifyProductsChanged();
  return product;
}

export async function upsertProductSnapshots(
  inputs: ProductSnapshotInput[],
  options: { notify?: boolean } = {},
) {
  if (inputs.length === 0) return [];

  const operations: PrismaPromise<unknown>[] = [];

  for (let start = 0; start < inputs.length; start += RAW_SQL_CHUNK_SIZE) {
    const chunk = inputs.slice(start, start + RAW_SQL_CHUNK_SIZE);
    const productRows = chunk.map(({ surugayaUrl, fetched }) => {
      const detailsJson =
        Object.keys(fetched.details).length > 0 ? JSON.stringify(fetched.details) : null;
      return Prisma.sql`(
        ${fetched.title},
        ${surugayaUrl},
        ${fetched.imageUrl},
        ${fetched.managementNumber},
        ${fetched.manufacturer},
        ${fetched.releaseDate},
        ${fetched.listPrice},
        ${fetched.modelNumber},
        ${fetched.category},
        ${detailsJson},
        ${fetched.salePrice},
        ${fetched.buyPrice},
        ${fetched.stockStatus},
        CURRENT_TIMESTAMP
      )`;
    });
    const historyRows = chunk.map(({ surugayaUrl, fetched }) =>
      Prisma.sql`(
        ${surugayaUrl},
        ${fetched.salePrice},
        ${fetched.buyPrice},
        ${fetched.stockStatus}
      )`,
    );

    operations.push(
      prisma.$queryRaw<StoredProductSnapshot[]>(Prisma.sql`
        INSERT INTO "Product" (
          "title",
          "surugayaUrl",
          "imageUrl",
          "managementNumber",
          "manufacturer",
          "releaseDate",
          "listPrice",
          "modelNumber",
          "category",
          "detailsJson",
          "latestSalePrice",
          "latestBuyPrice",
          "stockStatus",
          "updatedAt"
        )
        VALUES ${Prisma.join(productRows)}
        ON CONFLICT("surugayaUrl") DO UPDATE SET
          "title" = excluded."title",
          "imageUrl" = excluded."imageUrl",
          "managementNumber" = COALESCE(excluded."managementNumber", "Product"."managementNumber"),
          "manufacturer" = COALESCE(excluded."manufacturer", "Product"."manufacturer"),
          "releaseDate" = COALESCE(excluded."releaseDate", "Product"."releaseDate"),
          "listPrice" = COALESCE(excluded."listPrice", "Product"."listPrice"),
          "modelNumber" = COALESCE(excluded."modelNumber", "Product"."modelNumber"),
          "category" = COALESCE(excluded."category", "Product"."category"),
          "detailsJson" = COALESCE(excluded."detailsJson", "Product"."detailsJson"),
          "latestSalePrice" = excluded."latestSalePrice",
          "latestBuyPrice" = excluded."latestBuyPrice",
          "stockStatus" = excluded."stockStatus",
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING
          "id",
          "surugayaUrl",
          "title",
          "imageUrl",
          "manufacturer",
          "releaseDate",
          "modelNumber",
          "latestSalePrice",
          "latestBuyPrice",
          "stockStatus"
      `),
      prisma.$executeRaw(Prisma.sql`
        WITH "snapshots" (
          "surugayaUrl",
          "salePrice",
          "buyPrice",
          "stockStatus"
        ) AS (
          VALUES ${Prisma.join(historyRows)}
        )
        INSERT INTO "PriceHistory" (
          "productId",
          "salePrice",
          "buyPrice",
          "stockStatus"
        )
        SELECT
          "Product"."id",
          "snapshots"."salePrice",
          "snapshots"."buyPrice",
          "snapshots"."stockStatus"
        FROM "snapshots"
        INNER JOIN "Product"
          ON "Product"."surugayaUrl" = "snapshots"."surugayaUrl"
      `),
    );
  }

  const results = await prisma.$transaction(operations);
  const productsByUrl = new Map<string, StoredProductSnapshot>();
  for (let index = 0; index < results.length; index += 2) {
    for (const product of results[index] as StoredProductSnapshot[]) {
      productsByUrl.set(product.surugayaUrl, product);
    }
  }

  const products = inputs.map(({ surugayaUrl }) => {
    const product = productsByUrl.get(surugayaUrl);
    if (!product) {
      throw new Error(`保存した商品のIDを取得できませんでした: ${surugayaUrl}`);
    }
    return {
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      salePrice: product.latestSalePrice,
      buyPrice: product.latestBuyPrice,
      manufacturer: product.manufacturer,
      releaseDate: product.releaseDate,
      modelNumber: product.modelNumber,
      stockStatus: product.stockStatus,
      hasHistory: true,
    };
  });

  if (options.notify !== false) notifyProductsChanged();
  return products;
}
