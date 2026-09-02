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
  assert.match(js, /viewerProductMatchesSearch/u);
  assert.match(js, /summary\.searchText \|\| fallback/u);
  assert.match(js, /summary\.manufacturer/u);
  assert.match(js, /summary\.releaseDate/u);
  assert.match(js, /normalize\('NFKC'\)/u);
  assert.match(js, /商品名・ブランド・原画など/u);
});

test("Viewer価格変更は注目メーカーまたは巡回周期3日以上を初期表示にする", async () => {
  const js = await text("viewer/changes-focus-filter.js");
  assert.doesNotThrow(() => new Function(js));
  assert.match(js, /let scope = 'focused'/u);
  assert.match(js, /FEATURED_LIMIT = 20/u);
  assert.match(js, /BEEP/u);
  assert.match(js, /AiNO/u);
  assert.match(js, /暁/u);
  assert.match(js, /あっぷりけ/u);
  assert.match(js, /パープルソフトウェア/u);
  assert.match(js, /Navel/u);
  assert.match(js, /ぱれっと/u);
  assert.match(js, /days >= 3/u);
  assert.match(js, /featured\.has\(normalizeBrand\(product\.manufacturer\)\) \|\| isThreeDaysOrMore\(product\)/u);
});

test("Viewer価格変更は全商品へ切り替えられる", async () => {
  const js = await text("viewer/changes-focus-filter.js");
  assert.match(js, /data-change-scope="all"/u);
  assert.match(js, />全商品<\/button>/u);
  assert.match(js, /scope === 'all'/u);
  assert.match(js, /globalThis\.renderChanges/u);
});

test("Viewer価格変更UIはindexから読み込まれる", async () => {
  const html = await text("viewer/index.html");
  assert.match(html, /changes-main-ui\.css\?v=202608191453/u);
  assert.match(html, /changes-main-ui\.js\?v=202608191836/u);
  assert.match(html, /changes-focus-filter\.css\?v=202609021424/u);
  assert.match(html, /changes-focus-filter\.js\?v=202609021424/u);
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
  const scopeCss = await text("viewer/changes-focus-filter.css");
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.match(css, /\.viewer-change-table-wrap\s*\{[^}]*overflow:\s*visible/su);
  assert.match(css, /\.viewer-change-table\s*\{[^}]*min-width:\s*0/su);
  assert.match(css, /\.viewer-change-table thead\s*\{[^}]*display:\s*none/su);
  assert.match(css, /\.viewer-change-table tr\s*\{[^}]*display:\s*block/su);
  assert.match(css, /content:\s*attr\(data-label\)/u);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?grid-template-columns:\s*1fr/u);
  assert.doesNotMatch(css, /@media \(max-width: 760px\)[\s\S]*?overflow-x:\s*auto/u);
  assert.match(scopeCss, /@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/u);
  assert.doesNotMatch(scopeCss, /overflow-x:\s*auto/u);
});
