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

test("Viewerの商品詳細は巡回周期を閲覧用バッジとして表示する", async () => {
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
  const script = await readFile(
    new URL("../viewer/crawl-interval-display.js", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../viewer/mobile-detail-compact.css", import.meta.url),
    "utf8",
  );

  assert.match(html, /crawl-interval-display\.css\?v=/u);
  assert.match(html, /crawl-interval-display\.js\?v=/u);
  assert.doesNotMatch(html, /product-crawl-interval\.js/u);
  assert.doesNotMatch(html, /crawl-issue-utils\.js/u);
  assert.match(script, /\.detail-prices/u);
  assert.match(script, /detail \? `巡回周期 \$\{meta\.label\}`/u);
  assert.match(script, /crawl-interval-detail-badge/u);
  assert.match(css, /\.detail-prices \.crawl-interval-detail-badge/u);
});
