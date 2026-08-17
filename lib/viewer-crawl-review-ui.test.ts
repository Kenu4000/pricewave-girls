import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewerヘッダーでリクエスト右に周期振り分けを表示する", async () => {
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
  assert.match(html, /リクエスト<\/a>\s*<a href="#\/crawl-review">周期振り分け/u);
  assert.match(html, /crawl-review\.css/u);
  assert.match(html, /crawl-review\.js/u);
});

test("Viewer周期振り分けは1日商品のみを候補にする", async () => {
  const source = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  assert.match(source, /product\.crawlIntervalDays === 1/u);
  assert.match(source, /CONFIRMED_ONE_KEY/u);
  assert.match(source, /openRequestIds\.has\(product\.id\)/u);
  assert.match(source, /pending\.has\(product\.id\)/u);
});

test("1日のままは確認済みとして保存し周期が1日以外になれば記録を解除する", async () => {
  const source = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  assert.match(source, /confirmed\[String\(product\.id\)\]/u);
  assert.match(source, /product\.crawlIntervalDays !== 1/u);
  assert.match(source, /delete confirmed\[id\]/u);
});

test("3日7日14日無はGitHub Issue作成画面へ機械判別マーカー付きで渡す", async () => {
  const source = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  assert.match(source, /issues\/new/u);
  assert.match(source, /pricewave-crawl-interval-request product:\$\{product\.id\} interval:\$\{intervalValue\}/u);
  assert.match(source, /window\.open\(issueUrl\(product, interval\)/u);
  assert.match(source, /data-review-interval="3"/u);
  assert.match(source, /data-review-interval="7"/u);
  assert.match(source, /data-review-interval="14"/u);
  assert.match(source, /data-review-interval="off"/u);
});

test("open Issueが消えて商品がまだ1日なら再び候補になれる", async () => {
  const source = await readFile(new URL("../viewer/crawl-review.js", import.meta.url), "utf8");
  assert.match(source, /state=open/u);
  assert.match(source, /openRequestIds = ids/u);
  assert.match(source, /PENDING_GRACE_MS = 5 \* 60 \* 1000/u);
  assert.match(source, /now - Number\(createdAt\) > PENDING_GRACE_MS/u);
});
