import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("Viewer商品一覧の価格変動ラベルはmain同様カード先頭に置く", async () => {
  const css = await text("viewer/product-list-main-ui.css");
  assert.match(css, /\.tags\s*\{[^}]*order:\s*-1/su);
  assert.match(css, /\.tag\s*\{[^}]*border-radius:\s*999px/su);
  assert.match(css, /\.tag\.up\s*\{[^}]*#fff1f1/su);
  assert.match(css, /\.tag\.down\s*\{[^}]*#eef6ff/su);
});

test("Viewer商品一覧のモバイルでも価格変動ラベルをカード最上段にする", async () => {
  const css = await text("viewer/product-list-main-ui.css");
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /\.product-card \.tags\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*grid-row:\s*1/su);
  assert.match(css, /\.product-card \.product-image\s*\{[^}]*grid-row:\s*2 \/ 5/su);
});

test("Viewerはキャッシュキー付きでmain準拠の商品一覧CSSを読み込む", async () => {
  const html = await text("viewer/index.html");
  assert.match(html, /product-list-main-ui\.css\?v=[^"]+/u);
});
