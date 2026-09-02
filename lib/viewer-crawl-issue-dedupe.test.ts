import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewer公開画面は巡回周期変更Issueの作成機能を読み込まない", async () => {
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /crawl-issue-utils\.js/u);
  assert.doesNotMatch(html, /crawl-review\.js/u);
  assert.doesNotMatch(html, /product-crawl-interval\.js/u);
  assert.doesNotMatch(html, />リクエスト</u);
  assert.doesNotMatch(html, />周期振り分け</u);
});

test("Viewerの巡回周期は閲覧用表示と絞り込みだけを読み込む", async () => {
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");

  assert.match(html, /crawl-interval-display\.js\?v=/u);
  assert.match(html, /crawl-interval-filter\.js\?v=/u);
});
