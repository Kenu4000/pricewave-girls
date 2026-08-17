import { PrismaClient } from "@prisma/client";
import { productIdsAfterBrand } from "../lib/brand-order-bulk";

const prisma = new PrismaClient();
const UPDATE_CHUNK_SIZE = 400;
const VALID_INTERVALS = new Set([1, 3, 7, 14]);

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const boundaryBrand = argumentValue("after")?.trim() || "FLATZ";
  const interval = Number(argumentValue("days") || "7");

  if (!VALID_INTERVALS.has(interval)) {
    throw new Error("--days は 1 / 3 / 7 / 14 のいずれかを指定してください。");
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      manufacturer: true,
    },
  });

  const selection = productIdsAfterBrand(products, boundaryBrand);

  let changed = 0;
  for (let start = 0; start < selection.productIds.length; start += UPDATE_CHUNK_SIZE) {
    const ids = selection.productIds.slice(start, start + UPDATE_CHUNK_SIZE);
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: {
        crawlIntervalDays: interval,
        crawlIntervalReviewedAt: null,
      },
    });
    changed += result.count;
  }

  console.log(
    `${selection.boundary.label} 自体は変更せず、その後ろの ${selection.targetBrands.length}ブランド / ${changed}商品を${interval}日に変更しました。`,
  );
  if (selection.targetBrands.length > 0) {
    console.log(`先頭: ${selection.targetBrands[0].label}`);
    console.log(`末尾: ${selection.targetBrands.at(-1)?.label}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
