import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("ViewerはAQUAPLUS系表記をLeafへ統一する", async () => {
  const js = await text("viewer/leaf-brand-normalization.js");
  assert.match(js, /aquaplus/u);
  assert.match(js, /アクアプラス/u);
  assert.match(js, /リーフ/u);
  assert.match(js, /\? 'Leaf' : value/u);
  assert.match(js, /state\.data\.products/u);
  assert.match(js, /state\.data\.priceChanges/u);
  assert.doesNotThrow(() => new Function(js));
});

test("ViewerはLeaf表記正規化スクリプトを読み込む", async () => {
  const html = await text("viewer/index.html");
  assert.match(html, /leaf-brand-normalization\.js\?v=202609030540/u);
});
