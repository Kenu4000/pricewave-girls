import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("Viewer価格変更の注目表示は注目メーカーかつ巡回周期3日以上だけにする", async () => {
  const js = await text("viewer/changes-focus-filter.js");

  assert.match(
    js,
    /featured\.has\(normalizeBrand\(product\.manufacturer\)\)\s*&&\s*isThreeDaysOrMore\(product\)/u,
  );
  assert.doesNotMatch(
    js,
    /featured\.has\(normalizeBrand\(product\.manufacturer\)\)\s*\|\|\s*isThreeDaysOrMore\(product\)/u,
  );
  assert.match(js, /注目メーカー＋3日以上/u);
  assert.match(js, /全商品/u);
  assert.doesNotThrow(() => new Function(js));
});

test("Viewerは修正版の価格変更フィルタを読み込む", async () => {
  const html = await text("viewer/index.html");
  assert.match(html, /changes-focus-filter\.js\?v=202609030646/u);
});
