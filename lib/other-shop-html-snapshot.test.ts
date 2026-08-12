import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  extractCapturedOtherShopHtml,
  otherShopProductCode,
  otherShopSnapshotHtmlPath,
  otherShopSnapshotMetadataPath,
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

test("拡張機能が埋め込んだPC版とモバイル版の他店舗HTMLを別々に取り出す", () => {
  const productHtml = `<!doctype html><html><body>
    <textarea id="pricewave-other-shops-data" data-state="ready"><html><body><div>PC 5,700円</div></body></html></textarea>
    <textarea id="pricewave-other-shops-mobile-data" data-state="ready"><html><body><div>Mobile 5,700円</div></body></html></textarea>
  </body></html>`;
  const desktop = extractCapturedOtherShopHtml(productHtml, "desktop");
  const mobile = extractCapturedOtherShopHtml(productHtml, "mobile");
  assert.equal(desktop.state, "ready");
  assert.match(desktop.html ?? "", /PC 5,700円/u);
  assert.equal(mobile.state, "ready");
  assert.match(mobile.html ?? "", /Mobile 5,700円/u);
});

test("保存HTMLは取得したUIを残しつつscriptと入れ子iframeを除く", () => {
  const source = `<!doctype html><html><head><meta name="viewport" content="width=1200"><link rel="stylesheet" href="/css/common.css"><script src="/js/app.js"></script></head><body><a href="/product/detail/123">商品</a><iframe src="/foo"></iframe><div class="price">5,700円</div></body></html>`;
  const desktop = prepareOtherShopSnapshotHtml(
    source,
    "https://www.suruga-ya.jp/product/other/145070597",
    "desktop",
  );
  const mobile = prepareOtherShopSnapshotHtml(
    source,
    "https://www.suruga-ya.jp/product/other/145070597",
    "mobile",
  );

  assert.match(desktop, /<base href="https:\/\/www\.suruga-ya\.jp\/product\/other\/145070597" target="_blank">/u);
  assert.match(desktop, /href="\/css\/common\.css"/u);
  assert.match(desktop, /content="width=1200"/u);
  assert.match(desktop, /class="price">5,700円/u);
  assert.doesNotMatch(desktop, /<script/u);
  assert.doesNotMatch(desktop, /<iframe/u);

  assert.equal((mobile.match(/name="viewport"/gu) ?? []).length, 1);
  assert.match(
    mobile,
    /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/u,
  );
  assert.doesNotMatch(mobile, /width=1200/u);
});

test("PC版とモバイル版を別ファイルで保存し端末別の取得時刻を保持する", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "pricewave-other-shop-"));
  try {
    const url = "https://www.suruga-ya.jp/product/detail/145070597";
    const checkedAt = new Date("2026-08-12T13:40:00.000Z");
    const saved = await syncOtherShopSnapshotFromProductHtml({
      surugayaUrl: url,
      checkedAt,
      rootDir,
      productHtml: `<!doctype html><html><body>
        <textarea id="pricewave-other-shops-data" data-state="ready"><html><head></head><body><p>PC 状態難あり 5,700円</p></body></html></textarea>
        <textarea id="pricewave-other-shops-mobile-data" data-state="ready"><html><head></head><body><p>Mobile 状態難あり 5,700円</p></body></html></textarea>
      </body></html>`,
    });
    assert.equal(saved.status, "saved");
    assert.match(
      await readFile(otherShopSnapshotHtmlPath("145070597", rootDir, "desktop"), "utf8"),
      /PC 状態難あり/u,
    );
    assert.match(
      await readFile(otherShopSnapshotHtmlPath("145070597", rootDir, "mobile"), "utf8"),
      /Mobile 状態難あり/u,
    );
    assert.deepEqual(await readOtherShopSnapshotMetadata(url, rootDir), {
      productCode: "145070597",
      sourceUrl: "https://www.suruga-ya.jp/product/other/145070597",
      desktopCapturedAt: checkedAt.toISOString(),
      mobileCapturedAt: checkedAt.toISOString(),
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("旧capturedAt metadataはPC版として読み継ぐ", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "pricewave-other-shop-legacy-"));
  try {
    const url = "https://www.suruga-ya.jp/product/detail/145070597";
    const metadataPath = otherShopSnapshotMetadataPath("145070597", rootDir);
    await mkdir(path.dirname(metadataPath), { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({
        productCode: "145070597",
        sourceUrl: "https://www.suruga-ya.jp/product/other/145070597",
        capturedAt: "2026-08-12T13:40:00.000Z",
      }),
      "utf8",
    );
    assert.deepEqual(await readOtherShopSnapshotMetadata(url, rootDir), {
      productCode: "145070597",
      sourceUrl: "https://www.suruga-ya.jp/product/other/145070597",
      desktopCapturedAt: "2026-08-12T13:40:00.000Z",
      mobileCapturedAt: null,
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("not_applicableならPC版とモバイル版を両方消す", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "pricewave-other-shop-clear-"));
  try {
    const url = "https://www.suruga-ya.jp/product/detail/145070597";
    await syncOtherShopSnapshotFromProductHtml({
      surugayaUrl: url,
      checkedAt: new Date("2026-08-12T13:40:00.000Z"),
      rootDir,
      productHtml: `<!doctype html><html><body>
        <textarea id="pricewave-other-shops-data" data-state="ready"><html><body>desktop</body></html></textarea>
        <textarea id="pricewave-other-shops-mobile-data" data-state="ready"><html><body>mobile</body></html></textarea>
      </body></html>`,
    });
    const cleared = await syncOtherShopSnapshotFromProductHtml({
      surugayaUrl: url,
      checkedAt: new Date("2026-08-13T13:40:00.000Z"),
      rootDir,
      productHtml: `<!doctype html><html><body>
        <textarea id="pricewave-other-shops-data" data-state="not_applicable"></textarea>
        <textarea id="pricewave-other-shops-mobile-data" data-state="not_applicable"></textarea>
      </body></html>`,
    });
    assert.equal(cleared.status, "cleared");
    await assert.rejects(readFile(otherShopSnapshotHtmlPath("145070597", rootDir, "desktop"), "utf8"));
    await assert.rejects(readFile(otherShopSnapshotHtmlPath("145070597", rootDir, "mobile"), "utf8"));
    assert.equal(await readOtherShopSnapshotMetadata(url, rootDir), null);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("拡張機能はモバイルUAで専用HTMLを取得する", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../browser-extension/manifest.json", import.meta.url), "utf8"),
  ) as { version?: string; permissions?: string[] };
  const content = await readFile(new URL("../browser-extension/content.js", import.meta.url), "utf8");
  const wrapper = await readFile(
    new URL("../browser-extension/fast-site-mode-wrapper.js", import.meta.url),
    "utf8",
  );

  assert.equal(manifest.version, "0.11.7");
  assert.ok(manifest.permissions?.includes("declarativeNetRequestWithHostAccess"));
  assert.match(content, /pricewave-other-shops-mobile-data/u);
  assert.match(content, /pricewave_snapshot/u);
  assert.match(content, /"mobile"/u);
  assert.match(wrapper, /declarativeNetRequest\.updateSessionRules/u);
  assert.match(wrapper, /header: "user-agent"/u);
  assert.match(wrapper, /urlFilter: "pricewave_snapshot=mobile"/u);
  assert.doesNotThrow(() => new Function(content));
  assert.doesNotThrow(() => new Function(wrapper));
});

test("ローカル版とViewerはPCではPC版、モバイルではモバイル版を表示する", async () => {
  const component = await readFile(
    new URL("../components/JunkHistorySections.tsx", import.meta.url),
    "utf8",
  );
  const componentCss = await readFile(
    new URL("../components/JunkHistorySections.module.css", import.meta.url),
    "utf8",
  );
  const viewer = await readFile(new URL("../viewer/other-shop-embed.js", import.meta.url), "utf8");
  const viewerCss = await readFile(new URL("../viewer/other-shop-embed.css", import.meta.url), "utf8");

  assert.match(component, /variant=desktop/u);
  assert.match(component, /variant=mobile/u);
  assert.match(component, /styles\.desktopOnly/u);
  assert.match(component, /styles\.mobileOnly/u);
  assert.doesNotMatch(componentCss, /max-width: 420px/u);
  assert.match(componentCss, /\.mobileOnly[\s\S]*display: none/u);
  assert.match(componentCss, /@media \(max-width: 720px\)[\s\S]*\.desktopOnly[\s\S]*display: none/u);

  assert.match(viewer, /snapshot\.desktopPath/u);
  assert.match(viewer, /snapshot\.mobilePath/u);
  assert.match(viewer, /other-shop-desktop-only/u);
  assert.match(viewer, /other-shop-mobile-only/u);
  assert.doesNotMatch(viewerCss, /max-width:420px/u);
  assert.match(viewerCss, /other-shop-mobile-only\{display:none!important\}/u);
  assert.match(viewerCss, /@media\(max-width:760px\)[\s\S]*other-shop-desktop-only\{display:none!important\}/u);
});

test("importとviewer exportがPC版・モバイル版スナップショット処理を接続している", async () => {
  const importRoute = await readFile(new URL("../app/api/import/route.ts", import.meta.url), "utf8");
  const exporter = await readFile(new URL("../scripts/export-viewer-data.ts", import.meta.url), "utf8");
  assert.match(importRoute, /syncOtherShopSnapshotFromProductHtml/u);
  assert.match(importRoute, /24 \* 1024 \* 1024/u);
  assert.match(exporter, /exportOtherShopSnapshots/u);
  assert.match(exporter, /desktopPath/u);
  assert.match(exporter, /mobilePath/u);
  assert.match(exporter, /\.mobile\.html/u);
});
