import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("Viewer価格変更の注目表示は注目メーカーOR巡回周期1日・3日である", async () => {
  const js = await text("viewer/changes-main-ui.js");

  assert.match(
    js,
    /featured\.has\(normalizeBrand\(product\.manufacturer\)\)\s*\|\|\s*isOneOrThreeDays\(product\)/u,
  );
  assert.doesNotMatch(
    js,
    /featured\.has\(normalizeBrand\(product\.manufacturer\)\)\s*&&\s*isOneOrThreeDays\(product\)/u,
  );
  assert.match(js, /days === 1 \|\| days === 3/u);
  assert.match(js, />注目<\/button>/u);
  assert.match(js, /全商品/u);
  assert.doesNotThrow(() => new Function(js));
});

test("Viewerは外付け価格変更フィルタを読み込まず本体統合版を使う", async () => {
  const html = await text("viewer/index.html");
  assert.match(html, /changes-main-ui\.js\?v=202609031428/u);
  assert.doesNotMatch(html, /changes-focus-filter\.js/u);
});
