import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("注目度用priceChanges取得はrelation内のnot null条件をPrismaへ渡さない", async () => {
  const prismaSource = await readFile(new URL("./prisma.ts", import.meta.url), "utf8");
  const scoreSource = await readFile(
    new URL("./product-interest-score.ts", import.meta.url),
    "utf8",
  );

  assert.match(prismaSource, /priceChanges/u);
  assert.match(prismaSource, /isSaleBuyFilter/u);
  assert.match(prismaSource, /hasNotNull\(previousPrice\)/u);
  assert.match(prismaSource, /hasNotNull\(currentPrice\)/u);
  assert.match(prismaSource, /where: _ignoredWhere/u);
  assert.match(prismaSource, /priceChanges: relationWithoutWhere/u);

  // Relation側では広く取得しても、注目度計算側で対象type・null・同値を必ず除外する。
  assert.match(scoreSource, /change\.type === type/u);
  assert.match(scoreSource, /change\.previousPrice !== null/u);
  assert.match(scoreSource, /change\.currentPrice !== null/u);
  assert.match(scoreSource, /change\.previousPrice !== change\.currentPrice/u);
});
