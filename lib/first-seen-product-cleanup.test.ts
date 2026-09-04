import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("新規カード削除はProduct.createdAtではなく初回PriceHistory時刻で抽出する", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const script = await readFile("scripts/delete-first-seen-products.ts", "utf8");

  assert.match(
    packageJson.scripts["cleanup:first-seen-products"],
    /delete-first-seen-products\.ts/u,
  );
  assert.match(script, /histories:\s*\{/u);
  assert.match(script, /some:\s*\{\s*checkedAt:\s*\{\s*gte: from,\s*lt: to/u);
  assert.match(script, /none:\s*\{\s*checkedAt:\s*\{\s*lt: from/u);
  assert.doesNotMatch(script, /where:\s*\{\s*createdAt:/u);
});

test("新規カード削除はpreviewが既定でapply時だけProductを分割削除する", async () => {
  const script = await readFile("scripts/delete-first-seen-products.ts", "utf8");

  assert.match(script, /process\.argv\.includes\("--apply"\)/u);
  assert.match(script, /if \(!apply\)/u);
  assert.match(script, /DELETE_CHUNK_SIZE = 400/u);
  assert.match(script, /prisma\.product\.deleteMany/u);
  assert.match(script, /関連履歴はCASCADEで削除/u);
});
