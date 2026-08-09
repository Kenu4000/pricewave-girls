import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const queueSource = readFileSync(
  new URL("./product-import-queue.ts", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL("../app/api/import/route.ts", import.meta.url),
  "utf8",
);

test("import queueはDB保存時の一律refresh通知を止める", () => {
  assert.match(
    queueSource,
    /upsertProductSnapshotsWithTimeSale\([\s\S]*\{ notify: false \}/u,
  );
  assert.match(queueSource, /if \(items\.some\(\(item\) => item\.notifyChanged\)\)/u);
  assert.match(queueSource, /notifyProductsChanged\(\)/u);
});

test("手動記録は従来どおり通常通知、自動更新はsession側で通知を分けられる", () => {
  assert.match(routeSource, /const product = await productImportQueue\.enqueue\(\{/u);
  assert.match(routeSource, /return NextResponse\.json\(\{ id: product\.id \}/u);
});
