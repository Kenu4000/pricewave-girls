import { PrismaClient } from "@prisma/client";
import {
  PRODUCT_CONDITION_DETAIL_KEY,
  PRODUCT_CONDITION_RANK_DETAIL_KEY,
  splitProductTitleCondition,
} from "../lib/product-title-condition";

const prisma = new PrismaClient();
const TRANSACTION_PRODUCT_CHUNK = 100;
const MISPARSED_OTHER_SHOP_STORE_NAMES = [
  "管理番号",
  "メーカー",
  "発売日",
  "定価",
  "型番",
  "カテゴリ",
  "対応OS",
  "動作OS",
  "OS",
  "対応機種",
  "JAN",
  "ISBN",
];

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

  const removedMisparsedOtherShops = await prisma.junkHistory.deleteMany({
    where: {
      sourceType: "other_shop",
      storeName: { in: MISPARSED_OTHER_SHOP_STORE_NAMES },
    },
  });
  if (removedMisparsedOtherShops.count > 0) {
    console.log(`旧他店舗誤解析履歴を${removedMisparsedOtherShops.count}件削除しました。`);
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
