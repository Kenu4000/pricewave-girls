import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DELETE_CHUNK_SIZE = 400;

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function requiredDate(name: string): Date {
  const value = argument(name);
  if (!value) throw new Error(`--${name}=<ISO日時> を指定してください。`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`--${name} の日時が不正です: ${value}`);
  return date;
}

async function main() {
  const from = requiredDate("from");
  const to = requiredDate("to");
  const apply = process.argv.includes("--apply");
  if (from.getTime() >= to.getTime()) throw new Error("--from は --to より前にしてください。");

  // Product.createdAt が実際にカードが一覧へ現れた時刻を示さない既存データがあるため、
  // 「この時間帯に初めて価格履歴を持った商品」を新規カードとして扱う。
  // 範囲内に履歴が1件以上あり、範囲開始より前の履歴が1件もないProductだけを対象にする。
  const products = await prisma.product.findMany({
    where: {
      histories: {
        some: { checkedAt: { gte: from, lt: to } },
        none: { checkedAt: { lt: from } },
      },
    },
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      title: true,
      surugayaUrl: true,
      createdAt: true,
      condition: true,
      conditionRank: true,
      histories: {
        orderBy: { checkedAt: "asc" },
        take: 1,
        select: { checkedAt: true },
      },
    },
  });

  console.log(
    `対象: ${products.length}件 (初回価格履歴が ${from.toISOString()} 以上 / ${to.toISOString()} 未満)`,
  );
  for (const product of products) {
    const firstCheckedAt = product.histories[0]?.checkedAt;
    console.log(
      [
        product.id,
        firstCheckedAt?.toISOString() ?? "履歴なし",
        product.createdAt.toISOString(),
        product.conditionRank,
        product.condition ?? "通常",
        product.title,
        product.surugayaUrl,
      ].join("\t"),
    );
  }

  if (!apply) {
    console.log("確認のみです。削除する場合は --apply を付けて再実行してください。");
    return;
  }

  let deleted = 0;
  for (let start = 0; start < products.length; start += DELETE_CHUNK_SIZE) {
    const ids = products.slice(start, start + DELETE_CHUNK_SIZE).map((product) => product.id);
    if (ids.length === 0) continue;
    const result = await prisma.product.deleteMany({ where: { id: { in: ids } } });
    deleted += result.count;
  }

  console.log(`${deleted}件の商品カードを削除しました。関連履歴はCASCADEで削除されます。`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
