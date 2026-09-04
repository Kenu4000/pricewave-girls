import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("Viewer後付け処理は共通ランタイムのDOM監視を共有する", async () => {
  const runtime = await text("viewer/enhancement-runtime.js");
  const interval = await text("viewer/crawl-interval-display.js");
  const detail = await text("viewer/product-detail-enhancements.js");

  assert.equal(runtime.match(/new MutationObserver/gu)?.length ?? 0, 1);
  assert.match(runtime, /PricewaveViewerEnhancements/u);
  assert.match(runtime, /register\(name, enhancement\)/u);
  assert.match(runtime, /pricewave:viewer-rendered/u);
  assert.doesNotMatch(interval, /new MutationObserver/u);
  assert.doesNotMatch(detail, /new MutationObserver/u);
  assert.match(interval, /runtime\.register\('crawl-interval-display'/u);
  assert.match(detail, /runtime\.register\('product-detail-enhancements'/u);
});

test("Viewer共通ランタイムは補正対象より前、home-uiより前に読み込む", async () => {
  const html = await text("viewer/index.html");
  const runtime = html.indexOf("enhancement-runtime.js");
  const interval = html.indexOf("crawl-interval-display.js");
  const detail = html.indexOf("product-detail-enhancements.js");
  const home = html.indexOf("home-ui.js");

  assert.ok(runtime >= 0);
  assert.ok(runtime < interval);
  assert.ok(runtime < detail);
  assert.ok(detail < home);
  assert.equal(html.indexOf("<script", home), -1);
});
