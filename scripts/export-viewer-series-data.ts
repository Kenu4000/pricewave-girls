import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildSeriesProductGroups,
  findProductSeries,
  SERIES_CATALOG,
} from "@/lib/series-catalog";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "viewer-dist", "data");
const SERIES_DATA_DIR = path.join(OUTPUT_DIR, "series");

type ViewerSeriesIndexEntry = {
  id: string;
  name: string;
  definedTitleCount: number;
  path: string;
};

async function main() {
  await mkdir(SERIES_DATA_DIR, { recursive: true });

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      condition: true,
      conditionRank: true,
      modelNumber: true,
      releaseDate: true,
      histories: {
        orderBy: [{ checkedAt: "asc" }, { id: "asc" }],
        select: {
          checkedAt: true,
          salePrice: true,
        },
      },
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  const exportedSeriesIds = new Set<string>();

  for (const series of SERIES_CATALOG) {
    const groups = buildSeriesProductGroups(series, products);
    const lines = groups.flatMap((group) => {
      const productId = group.productIds[0];
      const product = productById.get(productId);
      if (!product) return [];

      const histories = product.histories.map((history) => ({
        checkedAt: history.checkedAt.toISOString(),
        salePrice: history.salePrice,
      }));
      if (!histories.some((history) => history.salePrice !== null)) return [];

      return [{
        productId: product.id,
        title: group.title,
        modelNumber: product.modelNumber,
        releaseDate: product.releaseDate,
        histories,
      }];
    });

    if (lines.length === 0) continue;
    exportedSeriesIds.add(series.id);
    await writeFile(
      path.join(SERIES_DATA_DIR, `${series.id}.json`),
      JSON.stringify(
        {
          id: series.id,
          name: series.name,
          definedTitleCount: series.titles.length,
          lines,
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  const productIndex: Record<string, ViewerSeriesIndexEntry> = {};
  for (const product of products) {
    const series = findProductSeries(product.title);
    if (!series || !exportedSeriesIds.has(series.id)) continue;
    productIndex[String(product.id)] = {
      id: series.id,
      name: series.name,
      definedTitleCount: series.titles.length,
      path: `data/series/${series.id}.json`,
    };
  }

  await writeFile(
    path.join(OUTPUT_DIR, "series-index.json"),
    JSON.stringify(
      {
        generatedAt: new Date(),
        products: productIndex,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Viewerシリーズ価格データ: ${exportedSeriesIds.size.toLocaleString("ja-JP")}シリーズ`);
  console.log(`Viewerシリーズ所属商品: ${Object.keys(productIndex).length.toLocaleString("ja-JP")}商品`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
