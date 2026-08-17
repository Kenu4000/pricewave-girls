import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("通常版の商品詳細で巡回周期を1・3・7・14・無へ変更できる", async () => {
  const page = await readFile(new URL("../app/products/[id]/page.tsx", import.meta.url), "utf8");
  const control = await readFile(
    new URL("../components/ProductCrawlIntervalControl.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../components/ProductCrawlIntervalControl.module.css", import.meta.url),
    "utf8",
  );
  const layout = await readFile(
    new URL("../app/products/[id]/ProductDetailLayout.module.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /ProductCrawlIntervalControl/u);
  assert.match(page, /initialValue=\{product\.crawlIntervalDays/u);
  assert.match(page, /layoutStyles\.crawlControl/u);
  assert.match(control, /label: "1日"/u);
  assert.match(control, /label: "3日"/u);
  assert.match(control, /label: "7日"/u);
  assert.match(control, /label: "14日"/u);
  assert.match(control, /label: "無"/u);
  assert.match(control, /\/api\/products\/\$\{productId\}\/crawl-interval/u);
  assert.match(control, /aria-pressed=\{selected\}/u);
  assert.match(control, /sameInterval\(value, nextValue\)/u);
  assert.doesNotMatch(control, /この商品を取得する頻度/u);
  assert.match(css, /display: flex/u);
  assert.match(css, /white-space: nowrap/u);
  assert.match(layout, /grid-column: 2 \/ -1/u);
});

test("Viewerの商品詳細にもコンパクトな巡回周期UIを表示し重複確認後に変更依頼Issueを開く", async () => {
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
  const script = await readFile(
    new URL("../viewer/product-crawl-interval.js", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../viewer/product-crawl-interval.css", import.meta.url),
    "utf8",
  );

  assert.match(html, /product-crawl-interval\.css/u);
  assert.match(html, /product-crawl-interval\.js/u);
  assert.match(html, /crawl-issue-utils\.js/u);
  assert.match(script, /label: '1日'/u);
  assert.match(script, /label: '3日'/u);
  assert.match(script, /label: '7日'/u);
  assert.match(script, /label: '14日'/u);
  assert.match(script, /label: '無'/u);
  assert.match(script, /pricewave-crawl-interval-request product:\$\{product\.id\}/u);
  assert.match(script, /issues\/new/u);
  assert.match(script, /aria-pressed/u);
  assert.match(script, /findOpenRequest\(product\.id, \{ force: true \}\)/u);
  assert.match(script, /既存の変更依頼を開きました/u);
  assert.doesNotMatch(script, /この商品を取得する頻度/u);
  assert.doesNotMatch(script, /同じ商品の未処理Issueを確認してからGitHubを開きます/u);
  assert.match(css, /display:flex/u);
  assert.match(css, /white-space:nowrap/u);
});
