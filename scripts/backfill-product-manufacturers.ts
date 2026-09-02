import { PrismaClient } from "@prisma/client";
import { manufacturerForProduct } from "../lib/product-manufacturer-override";

const prisma = new PrismaClient();
const CHUNK_SIZE = 100;

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, title: true, manufacturer: true },
  });

  const targets = products.flatMap((product) => {
    const manufacturer = manufacturerForProduct(product.title, product.manufacturer);
    return manufacturer !== product.manufacturer ? [{ id: product.id, manufacturer }] : [];
  });

  for (let start = 0; start < targets.length; start += CHUNK_SIZE) {
    const chunk = targets.slice(start, start + CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map((product) =>
        prisma.product.update({
          where: { id: product.id },
          data: { manufacturer: product.manufacturer },
        }),
      ),
    );
  }

  if (targets.length > 0) {
    console.log(`商品単位のメーカー補正を${targets.length}件適用しました。`);
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
