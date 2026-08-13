import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ローカル商品詳細は各値から絞り込み検索へ遷移できる", async () => {
  const page = await readFile(
    new URL("../app/products/[id]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /function DetailValueLinks/u);
  assert.match(page, /detailLabel/u);
  assert.match(page, /detailValue/u);
  assert.match(page, /productListUrl/u);
});

test("Viewerは商品詳細値をリンク化し詳細索引で商品を絞り込む", async () => {
  const viewer = await readFile(
    new URL("../viewer/detail-filter-links.js", import.meta.url),
    "utf8",
  );
  const indexHtml = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
  const exporter = await readFile(
    new URL("../scripts/export-viewer-data.ts", import.meta.url),
    "utf8",
  );

  assert.match(indexHtml, /detail-filter-links\.js/u);
  assert.match(viewer, /\.details-list > div/u);
  assert.match(viewer, /detailLabel/u);
  assert.match(viewer, /detailValue/u);
  assert.match(viewer, /detail-index\.json/u);
  assert.match(viewer, /matchingIds/u);
  assert.match(viewer, /絞り込み:/u);
  assert.match(exporter, /detailFilterValue/u);
  assert.match(exporter, /detail-index\.json/u);
  assert.match(exporter, /Object\.fromEntries\(detailIndex\)/u);
  assert.doesNotThrow(() => new Function(viewer));
});