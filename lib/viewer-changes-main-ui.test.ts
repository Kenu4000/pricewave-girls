import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("Viewer価格変更はmain準拠のフィルタと表UIを持つ", async () => {
  const js = await text("viewer/changes-main-ui.js");
  assert.match(js, /<span>検索<\/span>/u);
  assert.match(js, /ブランド/u);
  assert.match(js, /価格の種類/u);
  assert.match(js, /値動き/u);
  assert.match(js, /viewer-change-table/u);
  assert.match(js, /変更日時/u);
  assert.match(js, /変更前/u);
  assert.match(js, /変更後/u);
  assert.match(js, /data-label=/u);
  assert.doesNotThrow(() => new Function(js));
});

test("Viewer価格変更の検索は商品メタデータも対象にする", async () => {
  const js = await text("viewer/changes-main-ui.js");
  assert.match(js, /summary\.searchText \|\| fallback/u);
  assert.match(js, /summary\.manufacturer/u);
  assert.match(js, /summary\.releaseDate/u);
  assert.match(js, /normalize\('NFKC'\)/u);
  assert.match(js, /商品名・ブランド・原画など/u);
});

test("Viewer価格変更UIはindexから読み込まれる", async () => {
  const html = await text("viewer/index.html");
  assert.match(html, /changes-main-ui\.css\?v=202608191453/u);
  assert.match(html, /changes-main-ui\.js\?v=202608191826/u);
});

test("mainとViewerの商品タイトルは最大2行に制限する", async () => {
  const mainCss = await text("app/title-clamp.css");
  const viewerCss = await text("viewer/changes-main-ui.css");
  const layout = await text("app/layout.tsx");

  assert.match(mainCss, /\.product-title/u);
  assert.match(mainCss, /\.change-product-link span/u);
  assert.match(mainCss, /-webkit-line-clamp:\s*2/u);
  assert.match(viewerCss, /\.product-title/u);
  assert.match(viewerCss, /\.viewer-change-product-title/u);
  assert.match(viewerCss, /-webkit-line-clamp:\s*2/u);
  assert.match(layout, /\.\/title-clamp\.css/u);
});

test("Viewer価格変更はモバイルで横スクロール不要のカードUIにする", async () => {
  const css = await text("viewer/changes-main-ui.css");
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /\.viewer-change-table-wrap\s*\{[^}]*overflow:\s*visible/su);
  assert.match(css, /\.viewer-change-table\s*\{[^}]*min-width:\s*0/su);
  assert.match(css, /\.viewer-change-table thead\s*\{[^}]*display:\s*none/su);
  assert.match(css, /\.viewer-change-table tr\s*\{[^}]*display:\s*block/su);
  assert.match(css, /content:\s*attr\(data-label\)/u);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?grid-template-columns:\s*1fr/u);
  assert.doesNotMatch(css, /@media \(max-width: 760px\)[\s\S]*?overflow-x:\s*auto/u);
});
