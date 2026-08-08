import { PrismaClient } from "@prisma/client";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "viewer-dist");
const STATIC_DIR = path.join(ROOT, "viewer");
const PRODUCT_DATA_DIR = path.join(OUTPUT_DIR, "data", "products");

function parseDetailsJson(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function latestChangedAt(
  salePriceChangedAt: Date | null,
  buyPriceChangedAt: Date | null,
): Date | null {
  if (!salePriceChangedAt) return buyPriceChangedAt;
  if (!buyPriceChangedAt) return salePriceChangedAt;
  return salePriceChangedAt > buyPriceChangedAt ? salePriceChangedAt : buyPriceChangedAt;
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(PRODUCT_DATA_DIR, { recursive: true });
  await cp(STATIC_DIR, OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, ".nojekyll"), "", "utf8");

  const products = await prisma.product.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: {
      histories: { orderBy: [{ checkedAt: "asc" }, { id: "asc" }] },
      junkHistories: { orderBy: [{ checkedAt: "desc" }, { id: "desc" }] },
    },
  });

  const priceChanges = await prisma.priceChange.findMany({
    where: {
      type: { in: ["sale", "buy"] },
      previousPrice: { not: null },
      currentPrice: { not: null },
    },
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    include: {
      product: {
        select: { id: true, title: true, manufacturer: true, imageUrl: true },
      },
    },
  });

  const latestChangeByProduct = new Map<
    number,
    { sale?: (typeof priceChanges)[number]; buy?: (typeof priceChanges)[number] }
  >();
  for (const change of priceChanges) {
    const current = latestChangeByProduct.get(change.productId) ?? {};
    if (change.type === "sale" && !current.sale) current.sale = change;
    if (change.type === "buy" && !current.buy) current.buy = change;
    latestChangeByProduct.set(change.productId, current);
  }

  const summaries = products.map((product) => {
    const latestChange = latestChangeByProduct.get(product.id);
    return {
      id: product.id,
      title: product.title,
      surugayaUrl: product.surugayaUrl,
      imageUrl: product.imageUrl,
      manufacturer: product.manufacturer,
      releaseDate: product.releaseDate,
      listPrice: product.listPrice,
      latestSalePrice: product.latestSalePrice,
      latestRegularSalePrice: product.latestRegularSalePrice,
      latestBuyPrice: product.latestBuyPrice,
      stockStatus: product.stockStatus,
      condition: product.condition,
      conditionRank: product.conditionRank,
      isTimeSale: product.isTimeSale,
      timeSaleStartedAt: product.timeSaleStartedAt,
      timeSaleEndsAt: product.timeSaleEndsAt,
      updatedAt: product.updatedAt,
      priceChangedAt: latestChangedAt(product.salePriceChangedAt, product.buyPriceChangedAt),
      historyCount: product.histories.length,
      latestChanges: {
        sale: latestChange?.sale
          ? {
              previousPrice: latestChange.sale.previousPrice,
              currentPrice: latestChange.sale.currentPrice,
              changedAt: latestChange.sale.changedAt,
            }
          : null,
        buy: latestChange?.buy
          ? {
              previousPrice: latestChange.buy.previousPrice,
              currentPrice: latestChange.buy.currentPrice,
              changedAt: latestChange.buy.changedAt,
            }
          : null,
      },
    };
  });

  const publicChanges = priceChanges.map((change) => ({
    id: change.id,
    productId: change.productId,
    type: change.type,
    previousPrice: change.previousPrice,
    currentPrice: change.currentPrice,
    changedAt: change.changedAt,
    product: change.product,
  }));

  await writeFile(
    path.join(OUTPUT_DIR, "data", "index.json"),
    JSON.stringify(
      {
        generatedAt: new Date(),
        productCount: summaries.length,
        products: summaries,
        priceChanges: publicChanges,
      },
      null,
      2,
    ),
    "utf8",
  );

  for (const product of products) {
    await writeFile(
      path.join(PRODUCT_DATA_DIR, `${product.id}.json`),
      JSON.stringify(
        {
          product: {
            id: product.id,
            title: product.title,
            surugayaUrl: product.surugayaUrl,
            imageUrl: product.imageUrl,
            manufacturer: product.manufacturer,
            releaseDate: product.releaseDate,
            listPrice: product.listPrice,
            modelNumber: product.modelNumber,
            category: product.category,
            details: parseDetailsJson(product.detailsJson),
            latestSalePrice: product.latestSalePrice,
            latestRegularSalePrice: product.latestRegularSalePrice,
            latestBuyPrice: product.latestBuyPrice,
            stockStatus: product.stockStatus,
            condition: product.condition,
            conditionRank: product.conditionRank,
            isTimeSale: product.isTimeSale,
            timeSaleStartedAt: product.timeSaleStartedAt,
            timeSaleEndsAt: product.timeSaleEndsAt,
            updatedAt: product.updatedAt,
          },
          histories: product.histories,
          junkHistories: product.junkHistories,
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  console.log(`GitHub Pages用スナップショット: ${summaries.length}商品`);
  console.log(`出力先: ${OUTPUT_DIR}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
