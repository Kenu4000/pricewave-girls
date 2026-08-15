import { PrismaClient } from "@prisma/client";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  exportOtherShopSnapshots,
  readOtherShopSnapshotData,
} from "@/lib/other-shop-html-snapshot";
import { detailFilterValue } from "@/lib/product-filter-options";
import { isInternalProductDetailLabel } from "@/lib/time-sale";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "viewer-dist");
const STATIC_DIR = path.join(ROOT, "viewer");
const PRODUCT_DATA_DIR = path.join(OUTPUT_DIR, "data", "products");
const OTHER_SHOP_DATA_DIR = path.join(OUTPUT_DIR, "data", "other-shops");

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

function latestCheckedAt(product: {
  updatedAt: Date;
  histories: Array<{ checkedAt: Date }>;
}): Date {
  return product.histories.at(-1)?.checkedAt ?? product.updatedAt;
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(PRODUCT_DATA_DIR, { recursive: true });
  await cp(STATIC_DIR, OUTPUT_DIR, { recursive: true });
  await exportOtherShopSnapshots(OTHER_SHOP_DATA_DIR);
  await writeFile(path.join(OUTPUT_DIR, ".nojekyll"), "", "utf8");

  const products = await prisma.product.findMany({
    include: {
      histories: { orderBy: [{ checkedAt: "asc" }, { id: "asc" }] },
      junkHistories: { orderBy: [{ checkedAt: "desc" }, { id: "desc" }] },
    },
  });

  products.sort((left, right) => {
    const timeDifference = latestCheckedAt(right).getTime() - latestCheckedAt(left).getTime();
    return timeDifference || right.id - left.id;
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

  const detailIndex = new Map<string, number[]>();
  for (const product of products) {
    for (const [label, value] of Object.entries(parseDetailsJson(product.detailsJson))) {
      if (isInternalProductDetailLabel(label)) continue;
      const key = detailFilterValue(label, value);
      const ids = detailIndex.get(key) ?? [];
      ids.push(product.id);
      detailIndex.set(key, ids);
    }
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
      crawlIntervalDays: product.crawlIntervalDays,
      latestSalePrice: product.latestSalePrice,
      latestRegularSalePrice: product.latestRegularSalePrice,
      latestBuyPrice: product.latestBuyPrice,
      stockStatus: product.stockStatus,
      condition: product.condition,
      conditionRank: product.conditionRank,
      isTimeSale: product.isTimeSale,
      timeSaleStartedAt: product.timeSaleStartedAt,
      timeSaleEndsAt: product.timeSaleEndsAt,
      updatedAt: latestCheckedAt(product),
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

  await writeFile(
    path.join(OUTPUT_DIR, "data", "detail-index.json"),
    JSON.stringify(
      {
        generatedAt: new Date(),
        filters: Object.fromEntries(detailIndex),
      },
      null,
      2,
    ),
    "utf8",
  );

  for (const product of products) {
    const otherShopSnapshot = await readOtherShopSnapshotData(product.surugayaUrl);
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
            crawlIntervalDays: product.crawlIntervalDays,
            latestSalePrice: product.latestSalePrice,
            latestRegularSalePrice: product.latestRegularSalePrice,
            latestBuyPrice: product.latestBuyPrice,
            stockStatus: product.stockStatus,
            condition: product.condition,
            conditionRank: product.conditionRank,
            isTimeSale: product.isTimeSale,
            timeSaleStartedAt: product.timeSaleStartedAt,
            timeSaleEndsAt: product.timeSaleEndsAt,
            updatedAt: latestCheckedAt(product),
          },
          histories: product.histories,
          junkHistories: product.junkHistories,
          otherShopSnapshot: otherShopSnapshot
            ? {
                ...otherShopSnapshot,
                path: `data/other-shops/${otherShopSnapshot.productCode}.json`,
              }
            : null,
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  console.log(`GitHub Pages用スナップショット: ${summaries.length}商品`);
  console.log(`商品詳細絞り込み索引: ${detailIndex.size.toLocaleString("ja-JP")}条件`);
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
