import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  extractCapturedOtherShopHtml,
  otherShopProductCode,
  otherShopSnapshotHtmlPath,
  prepareOtherShopSnapshotHtml,
  readOtherShopSnapshotMetadata,
  syncOtherShopSnapshotFromProductHtml,
} from "./other-shop-html-snapshot";

test("商品URLからスナップショット用の商品コードを取り出す", () => {
  assert.equal(
    otherShopProductCode("https://www.suruga-ya.jp/product/detail/145070597"),
    "145070597",
  );
  assert.equal(otherShopProductCode("https://example.com/product/detail/145070597"), null);
});

test("拡張機能が埋め込んだ他店舗HTML全文を取り出す", () => {
  const capture = extractCapturedOtherShopHtml(`<!doctype html><html><body>
    <textarea id="pricewave-other-shops-data" data-state="ready"><html><head><title>他店舗</title></head><body><div>5,700円</div></body></html></textarea>
  </body></html>`);
  assert.equal(capture.state, "ready");
  assert.match(capture.html ?? "", /5,700円/u);
});

test("保存HTMLは駿河屋UIを残しつつscriptと入れ子iframeを除く", () => {
  const html = prepareOtherShopSnapshotHtml(
    `<!doctype html><html><head><link rel="stylesheet" href="/css/common.css"><script src="/js/app.js"></script></head><body><a href="/product/detail/123">商品</a><iframe src="/foo"></iframe><div class="price">5,700円</div></body></html>`,
    "https://www.suruga-ya.jp/product/other/145070597",
  );
  assert.match(html, /<base href="https:\/\/www\.suruga-ya\.jp\/product\/other\/145070597" target="_blank">/u);
  assert.match(html, /href="\/css\/common\.css"/u);
  assert.match(html, /class="price">5,700円/u);
  assert.doesNotMatch(html, /<script/u);
  assert.doesNotMatch(html, /<iframe/u);
});

test("保存HTMLはPC側のviewportを捨ててモバイルviewportへ固定する", () => {
  const html = prepareOtherShopSnapshotHtml(
    `<!doctype html><html><head><meta name="viewport" content="width=1200"><meta name="viewport" content="initial-scale=.5"></head><body></body></html>`,
    "https://www.suruga-ya.jp/product/other/145070597",
  );
  assert.equal((html.match(/name="viewport"/gu) ?? []).length, 1);
  assert.match(
    html,
    /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/u,
  );
  assert.doesNotMatch(html, /width=1200/u);
  assert.match(html, /max-width:100%!important/u);
  assert.match(html, /overflow-x:hidden!important/u);
});

test("ローカル版とViewerのiframeを常にモバイル幅へ制限する", async () => {
  const componentCss = await readFile(
    new URL("../components/JunkHistorySections.module.css", import.meta.url),
    "utf8",
  );
  const viewerCss = await readFile(new URL("../viewer/other-shop-embed.css", import.meta.url), "utf8");
  assert.match(componentCss, /max-width: 420px;/u);
  assert.match(componentCss, /margin-inline: auto;/u);
  assert.match(componentCss, /height: min\(760px, 78vh\);/u);
  assert.match(viewerCss, /max-width:420px/u);
  assert.match(viewerCss, /margin-inline:auto/u);
  assert.match(viewerCss, /height:min\(760px,78vh\)/u);
});

test("readyなら最新HTMLと取得時刻を保存しnot_applicableなら消す", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "pricewave-other-shop-"));
  try {
    const url = "https://www.suruga-ya.jp/product/detail/145070597";
    const checkedAt = new Date("2026-08-12T13:40:00.000Z");
    const saved = await syncOtherShopSnapshotFromProductHtml({
      surugayaUrl: url,
      checkedAt,
      rootDir,
      productHtml: `<!doctype html><html><body><textarea id="pricewave-other-shops-data" data-state="ready"><html><head></head><body><p>状態難あり 5,700円</p></body></html></textarea></body></html>`,
    });
    assert.equal(saved.status, "saved");
    assert.match(await readFile(otherShopSnapshotHtmlPath("145070597", rootDir), "utf8"), /5,700円/u);
    assert.deepEqual(await readOtherShopSnapshotMetadata(url, rootDir), {
      productCode: "145070597",
      capturedAt: checkedAt.toISOString(),
      sourceUrl: "https://www.suruga-ya.jp/product/other/145070597",
    });

    const cleared = await syncOtherShopSnapshotFromProductHtml({
      surugayaUrl: url,
      checkedAt: new Date("2026-08-13T13:40:00.000Z"),
      rootDir,
      productHtml: `<!doctype html><html><body><textarea id="pricewave-other-shops-data" data-state="not_applicable"></textarea></body></html>`,
    });
    assert.equal(cleared.status, "cleared");
    await assert.rejects(readFile(otherShopSnapshotHtmlPath("145070597", rootDir), "utf8"));
    assert.equal(await readOtherShopSnapshotMetadata(url, rootDir), null);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("importとviewer exportがHTMLスナップショット処理を接続している", async () => {
  const importRoute = await readFile(new URL("../app/api/import/route.ts", import.meta.url), "utf8");
  const exporter = await readFile(new URL("../scripts/export-viewer-data.ts", import.meta.url), "utf8");
  assert.match(importRoute, /syncOtherShopSnapshotFromProductHtml/u);
  assert.match(exporter, /exportOtherShopSnapshots/u);
  assert.match(exporter, /otherShopSnapshot/u);
  assert.match(exporter, /data\/other-shops\//u);
});
