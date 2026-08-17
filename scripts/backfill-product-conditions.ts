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

function cleanMalformedCondition(value: string | null): string | null {
  if (!value) return value;
  if (!/&(?:nbsp|quot|lt|gt|amp);|<[^>]+>|class\s*=/iu.test(value)) return value;

  let text = value
    .replace(/&nbsp;/giu, " ")
    .replace(/&quot;/giu, '"')
    .replace(/&gt;/giu, ">")
    .replace(/&lt;/giu, "<")
    .replace(/&amp;/giu, "&")
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  const marker = text.match(/(?:中古|新品|予約)\s*/u);
  if (marker && marker.index !== undefined) {
    text = text.slice(marker.index + marker[0].length);
  }

  text = text
    .replace(/[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*円.*$/u, "")
    .replace(/\(税込\)|（税込）/gu, "")
    .replace(/^ランク\s*B\s*/iu, "")
    .replace(/^["'<>\s]+|["'<>\s]+$/gu, "")
    .trim();

  return text || value;
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

  const malformedProducts = products.flatMap((product) => {
    const condition = cleanMalformedCondition(product.condition);
    const details = parseDetailsJson(product.detailsJson);
    const storedCondition = details[PRODUCT_CONDITION_DETAIL_KEY] ?? null;
    const cleanedStoredCondition = cleanMalformedCondition(storedCondition);
    const nextCondition = condition !== product.condition ? condition : cleanedStoredCondition;
    if (!nextCondition || (nextCondition === product.condition && cleanedStoredCondition === storedCondition)) {
      return [];
    }

    details[PRODUCT_CONDITION_DETAIL_KEY] = nextCondition;
    details[PRODUCT_CONDITION_RANK_DETAIL_KEY] = "B";
    return [{ id: product.id, condition: nextCondition, detailsJson: JSON.stringify(details) }];
  });

  for (let start = 0; start < malformedProducts.length; start += TRANSACTION_PRODUCT_CHUNK) {
    const chunk = malformedProducts.slice(start, start + TRANSACTION_PRODUCT_CHUNK);
    await prisma.$transaction(
      chunk.map((product) =>
        prisma.product.update({
          where: { id: product.id },
          data: {
            condition: product.condition,
            conditionRank: "B",
            detailsJson: product.detailsJson,
          },
        }),
      ),
    );
  }

  const malformedHistories = (await prisma.priceHistory.findMany({
    where: { conditionRank: "B", condition: { not: null } },
    select: { id: true, condition: true },
  })).flatMap((history) => {
    const condition = cleanMalformedCondition(history.condition);
    return condition && condition !== history.condition ? [{ id: history.id, condition }] : [];
  });

  for (let start = 0; start < malformedHistories.length; start += TRANSACTION_PRODUCT_CHUNK) {
    const chunk = malformedHistories.slice(start, start + TRANSACTION_PRODUCT_CHUNK);
    await prisma.$transaction(
      chunk.map((history) =>
        prisma.priceHistory.update({
          where: { id: history.id },
          data: { condition: history.condition },
        }),
      ),
    );
  }

  if (malformedProducts.length > 0 || malformedHistories.length > 0) {
    console.log(
      `壊れた状態名を商品${malformedProducts.length}件・履歴${malformedHistories.length}件補正しました。`,
    );
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
