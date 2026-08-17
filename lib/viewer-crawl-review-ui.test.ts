import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewerヘッダーでリクエスト右に周期振り分けを表示する", async () => {
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
  assert.match(html, /リクエスト<\/a>\s*<a href="#\/crawl-review">周期振り分け/u);
  assert.match(html, /crawl-review\.css/u);
  assert.match(html, /crawl-review\.js/u);
});

test("Viewer周期振り分けは未確認の1日商品だけを候補にする", async () => {
  const source = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  assert.match(source, /product\.crawlIntervalDays === 1/u);
  assert.match(source, /CONFIRMED_ONE_KEY/u);
  assert.match(source, /openRequestsByProduct\.has\(product\.id\)/u);
  assert.match(source, /pending\.has\(product\.id\)/u);
  assert.match(source, /snapshotIsOlderThanRequest\(product\.id\)/u);
});

test("1日のままは確認済みとして保存し周期が1日以外になれば記録を解除する", async () => {
  const source = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  assert.match(source, /confirmed\[String\(product\.id\)\]/u);
  assert.match(source, /product\.crawlIntervalDays !== 1/u);
  assert.match(source, /delete confirmed\[id\]/u);
});

test("3日7日14日無は同一商品のopen Issueを再確認してから変更依頼を開く", async () => {
  const source = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  assert.match(source, /issues\/new/u);
  assert.match(source, /pricewave-crawl-interval-request product:\$\{product\.id\} interval:\$\{intervalValue\}/u);
  assert.match(source, /loadRequests\(\{ force: true \}\)/u);
  assert.match(source, /openRequestsByProduct\.get\(product\.id\)/u);
  assert.match(source, /data-review-interval="3"/u);
  assert.match(source, /data-review-interval="7"/u);
  assert.match(source, /data-review-interval="14"/u);
  assert.match(source, /data-review-interval="off"/u);
});

test("Viewerより新しいclose済みIssueは次回Viewer更新まで1日候補へ戻さない", async () => {
  const source = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  const helper = await readFile(new URL("../viewer/crawl-issue-utils.js", import.meta.url), "utf8");

  assert.match(helper, /state=all/u);
  assert.match(helper, /hasRequestNewerThanSnapshot/u);
  assert.match(helper, /request\.closedAt \|\| request\.updatedAt \|\| request\.createdAt/u);
  assert.match(source, /snapshotIsOlderThanRequest/u);
  assert.match(source, /state\.data\?\.generatedAt/u);
  assert.match(source, /!snapshotIsOlderThanRequest\(product\.id\)/u);
  assert.match(source, /PENDING_GRACE_MS = 5 \* 60 \* 1000/u);
});
