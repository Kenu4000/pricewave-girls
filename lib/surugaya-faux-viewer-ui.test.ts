import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewerの他店舗一覧は駿河屋ページ風のUIへ上書きされる", async () => {
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
  const script = await readFile(
    new URL("../viewer/surugaya-faux-ui.js", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../viewer/surugaya-faux-ui.css", import.meta.url),
    "utf8",
  );

  assert.match(html, /other-shop-embed\.js[\s\S]*surugaya-faux-ui\.js/u);
  assert.match(html, /surugaya-faux-ui\.css/u);
  assert.match(script, /viewerCurrentOfferList = function/u);
  assert.match(script, /logo-surugaya\.svg\.webp/u);
  assert.match(script, /コンディション/u);
  assert.match(script, /購入オプション/u);
  assert.match(script, /価格が安い順/u);
  assert.match(css, /--suru-blue:#171c88/u);
  assert.match(css, /--suru-red:#d40000/u);
  assert.match(css, /@media\(max-width:760px\)/u);
  assert.doesNotThrow(() => new Function(script));
});

test("偽iframe内の操作要素は個別機能を再現せず駿河屋本体を別タブで開く", async () => {
  const script = await readFile(
    new URL("../viewer/surugaya-faux-ui.js", import.meta.url),
    "utf8",
  );

  assert.match(script, /data-suru-faux-link/u);
  assert.match(script, /window\.open\(href, '_blank', 'noopener,noreferrer'\)/u);
  assert.match(script, /document\.addEventListener\('click', openFauxProxy, true\)/u);
  assert.match(script, /document\.addEventListener\('keydown'/u);
  assert.match(script, /fakeHeader\(href\)/u);
  assert.match(script, /tabs\(items, href\)/u);
  assert.match(script, /配送料<\/a> および <a href="\$\{href\}" target="_blank" rel="noreferrer">返品について/u);
  assert.match(script, /alt="カートに入れる"/u);
  assert.doesNotMatch(script, /location\.href\s*=|history\.pushState/u);
});
