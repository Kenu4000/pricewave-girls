import { PrismaClient } from "@prisma/client";
import {
  PRODUCT_CONDITION_DETAIL_KEY,
  PRODUCT_CONDITION_RANK_DETAIL_KEY,
  splitProductTitleCondition,
} from "../lib/product-title-condition";

const prisma = new PrismaClient();
const TRANSACTION_PRODUCT_CHUNK = 100;

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

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      condition: true,
      conditionRank: true,
      detailsJson: true,
    },
  });

  const targets = products.flatMap((product) => {
    const parsed = splitProductTitleCondition(product.title);
    if (parsed.conditionRank !== "B" || !parsed.condition) return [];

    const details = parseDetailsJson(product.detailsJson);
    details[PRODUCT_CONDITION_DETAIL_KEY] = parsed.condition;
    details[PRODUCT_CONDITION_RANK_DETAIL_KEY] = "B";
    return [{ product, parsed, detailsJson: JSON.stringify(details) }];
  });

  for (let start = 0; start < targets.length; start += TRANSACTION_PRODUCT_CHUNK) {
    const chunk = targets.slice(start, start + TRANSACTION_PRODUCT_CHUNK);
    await prisma.$transaction(
      chunk.flatMap(({ product, parsed, detailsJson }) => [
        prisma.product.update({
          where: { id: product.id },
          data: {
            title: parsed.title,
            condition: parsed.condition,
            conditionRank: "B",
            detailsJson,
          },
        }),
        prisma.priceHistory.updateMany({
          where: { productId: product.id },
          data: {
            condition: parsed.condition,
            conditionRank: "B",
          },
        }),
      ]),
    );
  }

  if (targets.length > 0) {
    console.log(`状態表記付き商品を${targets.length}件分離しました。`);
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
