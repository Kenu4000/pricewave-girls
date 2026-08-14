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
