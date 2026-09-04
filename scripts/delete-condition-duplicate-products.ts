import { PrismaClient } from "@prisma/client";
import { findConditionDuplicateProducts } from "../lib/condition-duplicate-products";

const prisma = new PrismaClient();
const DELETE_CHUNK_SIZE = 400;

async function main() {
  const apply = process.argv.includes("--apply");
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      condition: true,
      conditionRank: true,
      detailsJson: true,
      surugayaUrl: true,
    },
  });

  const duplicates = findConditionDuplicateProducts(products);
  console.log(`状態違いの重複商品: ${duplicates.length}件`);

  for (const match of duplicates) {
    console.log(
      [
        `削除候補 #${match.product.id}`,
        match.product.title,
        match.product.condition ? `状態=${match.product.condition}` : null,
        `通常商品ID=${match.normalProductIds.join(",")}`,
        match.product.surugayaUrl,
      ]
        .filter(Boolean)
        .join("\t"),
    );
  }

  if (!apply) {
    console.log("確認のみです。削除する場合は --apply を付けて再実行してください。");
    return;
  }

  let deleted = 0;
  const ids = duplicates.map((match) => match.product.id);
  for (let start = 0; start < ids.length; start += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + DELETE_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const result = await prisma.product.deleteMany({ where: { id: { in: chunk } } });
    deleted += result.count;
  }

  console.log(
    `${deleted}件の状態違い重複商品を削除しました。PriceHistory / PriceChange / JunkHistory はCASCADEで削除されます。`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
