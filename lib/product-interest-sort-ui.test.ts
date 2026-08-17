import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/products/page.tsx", import.meta.url), "utf8");

test("商品一覧に注目度が高い順を追加する", () => {
  assert.match(page, /value: "interesting-desc", label: "注目度が高い順"/u);
  assert.match(page, /sortProductsByInterest/u);
  assert.match(page, /priceChanges:\s*\{/u);
  assert.match(page, /type: \{ in: \["sale", "buy"\] \}/u);
});
