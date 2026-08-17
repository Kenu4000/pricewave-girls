import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewerは巡回周期変更Issueを作る直前に同一商品のopen Issueを再確認する", async () => {
  const helper = await readFile(new URL("../viewer/crawl-issue-utils.js", import.meta.url), "utf8");
  const review = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  const detail = await readFile(new URL("../viewer/product-crawl-interval.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");

  assert.match(helper, /state=all/u);
  assert.match(helper, /findOpenRequest/u);
  assert.match(helper, /request\.state === 'open'/u);
  assert.match(review, /loadRequests\(\{ force: true \}\)/u);
  assert.match(review, /openRequestsByProduct\.get\(product\.id\)/u);
  assert.match(review, /existing\.url/u);
  assert.match(detail, /findOpenRequest\(product\.id, \{ force: true \}\)/u);
  assert.match(detail, /existing\?\.url/u);

  const appIndex = html.indexOf('./app.js');
  const helperIndex = html.indexOf('./crawl-issue-utils.js');
  const reviewIndex = html.indexOf('./crawl-review.js');
  const detailIndex = html.indexOf('./product-crawl-interval.js');
  assert.ok(appIndex >= 0);
  assert.ok(helperIndex > appIndex);
  assert.ok(reviewIndex > helperIndex);
  assert.ok(detailIndex > helperIndex);
});

test("Viewerより新しい巡回周期Issueはclose後も次回Viewer更新まで候補へ戻さない", async () => {
  const helper = await readFile(new URL("../viewer/crawl-issue-utils.js", import.meta.url), "utf8");
  const review = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");

  assert.match(helper, /hasRequestNewerThanSnapshot/u);
  assert.match(helper, /request\.closedAt \|\| request\.updatedAt \|\| request\.createdAt/u);
  assert.match(review, /snapshotIsOlderThanRequest/u);
  assert.match(review, /!snapshotIsOlderThanRequest\(product\.id\)/u);
});
