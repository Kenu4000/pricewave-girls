import { prisma } from "@/lib/prisma";
import { notifyProductsChanged } from "@/lib/product-events";
import type { FetchedProduct } from "@/lib/surugaya";
import { Prisma, type PrismaPromise } from "@prisma/client";

export type ProductSnapshotInput = {
  surugayaUrl: string;
  fetched: FetchedProduct;
};

// Prisma's bundled SQLite supports enough bind variables for 1,000 rows here.
// One multi-row UPSERT plus history INSERTs keep database work batched while
// the surrounding transaction preserves atomicity.
const RAW_SQL_CHUNK_SIZE = 1_000;
const JUNK_SQL_CHUNK_SIZE = 5_000;
const PRICE_CHANGE_SQL_CHUNK_SIZE = 5_000;

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
  salePriceChangedAt: Date | string | null;
  buyPriceChangedAt: Date | string | null;
  stockStatus: string | null;
};

type ExistingPriceState = {
  latestSalePrice: number | null;
  latestBuyPrice: number | null;
};

function latestPriceChange(
  salePriceChangedAt: Date | string | null,
  buyPriceChangedAt: Date | string | null,
): string | null {
  const timestamps = [salePriceChangedAt, buyPriceChangedAt]
    .flatMap((value) => (value ? [new Date(value)] : []))
    .filter((value) => !Number.isNaN(value.getTime()));
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps.map((value) => value.getTime()))).toISOString();
}

function buildProductUpsertArgs(
  surugayaUrl: string,
  fetched: FetchedProduct,
  existing: ExistingPriceState | null,
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
  const changedAt = new Date();
  const priceChangeCreates = existing
    ? [
        ...(existing.latestSalePrice !== fetched.salePrice
          ? [{
              type: "sale",
              previousPrice: existing.latestSalePrice,
              currentPrice: fetched.salePrice,
              changedAt,
            }]
          : []),
        ...(existing.latestBuyPrice !== fetched.buyPrice
          ? [{
              type: "buy",
              previousPrice: existing.latestBuyPrice,
              currentPrice: fetched.buyPrice,
              changedAt,
            }]
          : []),
      ]
    : [];
  const priceChangeUpdates = {
    ...(priceChangeCreates.some((change) => change.type === "sale")
      ? { salePriceChangedAt: changedAt }
      : {}),
    ...(priceChangeCreates.some((change) => change.type === "buy")
      ? { buyPriceChangedAt: changedAt }
      : {}),
  };
  const junkHistoryCreates = fetched.junkItems.map((item) => ({
    condition: item.condition,
    price: item.price,
  }));

  return {
    where: { surugayaUrl },
    update: {
      title: fetched.title,
      imageUrl: fetched.imageUrl,
      latestSalePrice: fetched.salePrice,
      latestBuyPrice: fetched.buyPrice,
      stockStatus: fetched.stockStatus,
      ...priceChangeUpdates,
      ...detailUpdates,
      histories: { create: snapshot },
      ...(junkHistoryCreates.length > 0
        ? { junkHistories: { create: junkHistoryCreates } }
        : {}),
      ...(priceChangeCreates.length > 0
        ? { priceChanges: { create: priceChangeCreates } }
        : {}),
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
      ...(junkHistoryCreates.length > 0
        ? { junkHistories: { create: junkHistoryCreates } }
        : {}),
    },
    select: { id: true },
  };
}

export async function upsertProductSnapshot(
  surugayaUrl: string,
  fetched: FetchedProduct,
) {
  const existing = await prisma.product.findUnique({
    where: { surugayaUrl },
    select: { latestSalePrice: true, latestBuyPrice: true },
  });
  const product = await prisma.product.upsert(
    buildProductUpsertArgs(surugayaUrl, fetched, existing),
  );

  notifyProductsChanged();
  return product;
}

export async function upsertProductSnapshots(
  inputs: ProductSnapshotInput[],
  options: { notify?: boolean } = {},
) {
  if (inputs.length === 0) return [];

  const existingProducts = await prisma.product.findMany({
    where: { surugayaUrl: { in: inputs.map((input) => input.surugayaUrl) } },
    select: { surugayaUrl: true, latestSalePrice: true, latestBuyPrice: true },
  });
  const existingUrls = new Set(existingProducts.map((product) => product.surugayaUrl));
  const existingProductsByUrl = new Map(
    existingProducts.map((product) => [product.surugayaUrl, product]),
  );
  const operations: PrismaPromise<unknown>[] = [];
  const productResultIndexes: number[] = [];

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
    const junkRows = chunk.flatMap(({ surugayaUrl, fetched }) =>
      fetched.junkItems.map((item) => ({ surugayaUrl, ...item })),
    );
    const priceChangeRows = chunk.flatMap(({ surugayaUrl, fetched }) => {
      const existing = existingProductsByUrl.get(surugayaUrl);
      if (!existing) return [];
      return [
        ...(existing.latestSalePrice !== fetched.salePrice
          ? [{
              surugayaUrl,
              type: "sale",
              previousPrice: existing.latestSalePrice,
              currentPrice: fetched.salePrice,
            }]
          : []),
        ...(existing.latestBuyPrice !== fetched.buyPrice
          ? [{
              surugayaUrl,
              type: "buy",
              previousPrice: existing.latestBuyPrice,
              currentPrice: fetched.buyPrice,
            }]
          : []),
      ];
    });

    productResultIndexes.push(operations.length);
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
          "salePriceChangedAt" = CASE
            WHEN "Product"."latestSalePrice" IS NOT excluded."latestSalePrice"
            THEN CURRENT_TIMESTAMP
            ELSE "Product"."salePriceChangedAt"
          END,
          "buyPriceChangedAt" = CASE
            WHEN "Product"."latestBuyPrice" IS NOT excluded."latestBuyPrice"
            THEN CURRENT_TIMESTAMP
            ELSE "Product"."buyPriceChangedAt"
          END,
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
          "salePriceChangedAt",
          "buyPriceChangedAt",
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

    for (
      let changeStart = 0;
      changeStart < priceChangeRows.length;
      changeStart += PRICE_CHANGE_SQL_CHUNK_SIZE
    ) {
      const changeChunk = priceChangeRows.slice(
        changeStart,
        changeStart + PRICE_CHANGE_SQL_CHUNK_SIZE,
      );
      const values = changeChunk.map((change) =>
        Prisma.sql`(
          ${change.surugayaUrl},
          ${change.type},
          ${change.previousPrice},
          ${change.currentPrice}
        )`,
      );
      operations.push(
        prisma.$executeRaw(Prisma.sql`
          WITH "changeSnapshots" (
            "surugayaUrl",
            "type",
            "previousPrice",
            "currentPrice"
          ) AS (
            VALUES ${Prisma.join(values)}
          )
          INSERT INTO "PriceChange" (
            "productId",
            "type",
            "previousPrice",
            "currentPrice"
          )
          SELECT
            "Product"."id",
            "changeSnapshots"."type",
            "changeSnapshots"."previousPrice",
            "changeSnapshots"."currentPrice"
          FROM "changeSnapshots"
          INNER JOIN "Product"
            ON "Product"."surugayaUrl" = "changeSnapshots"."surugayaUrl"
        `),
      );
    }

    for (let junkStart = 0; junkStart < junkRows.length; junkStart += JUNK_SQL_CHUNK_SIZE) {
      const junkChunk = junkRows.slice(junkStart, junkStart + JUNK_SQL_CHUNK_SIZE);
      const values = junkChunk.map((item) =>
        Prisma.sql`(${item.surugayaUrl}, ${item.condition}, ${item.price})`,
      );
      operations.push(
        prisma.$executeRaw(Prisma.sql`
          WITH "junkSnapshots" (
            "surugayaUrl",
            "condition",
            "price"
          ) AS (
            VALUES ${Prisma.join(values)}
          )
          INSERT INTO "JunkHistory" (
            "productId",
            "condition",
            "price"
          )
          SELECT
            "Product"."id",
            "junkSnapshots"."condition",
            "junkSnapshots"."price"
          FROM "junkSnapshots"
          INNER JOIN "Product"
            ON "Product"."surugayaUrl" = "junkSnapshots"."surugayaUrl"
        `),
      );
    }
  }

  const results = await prisma.$transaction(operations);
  const productsByUrl = new Map<string, StoredProductSnapshot>();
  for (const index of productResultIndexes) {
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
      priceChangedAt: latestPriceChange(
        product.salePriceChangedAt,
        product.buyPriceChangedAt,
      ),
      manufacturer: product.manufacturer,
      releaseDate: product.releaseDate,
      modelNumber: product.modelNumber,
      stockStatus: product.stockStatus,
      hasHistory: true,
      isNew: !existingUrls.has(surugayaUrl),
    };
  });

  if (options.notify !== false) notifyProductsChanged();
  return products;
}
