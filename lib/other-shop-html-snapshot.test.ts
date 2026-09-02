import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  exportOtherShopSnapshots,
  extractCapturedOtherShopHtml,
  otherShopProductCode,
  otherShopSnapshotJsonPath,
  parseOtherShopSnapshotItems,
  readOtherShopSnapshotData,
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

test("拡張機能が埋め込んだ他店舗HTMLを一つだけ取り出す", () => {
  const productHtml = `<!doctype html><html><body>
    <textarea id="pricewave-other-shops-data" data-state="ready"><html><body><div>5,700円</div></body></html></textarea>
  </body></html>`;
  const capture = extractCapturedOtherShopHtml(productHtml);
  assert.equal(capture.state, "ready");
  assert.match(capture.html ?? "", /5,700円/u);
});

test("他店舗HTMLを表示端末に依存しない構造化データへ変換する", () => {
  const items = parseOtherShopSnapshotItems(`<!doctype html><html><body>
    <table><tbody><tr>
      <td>5,700円(税込)</td>
      <td><a href="/product/detail/145070597?branch_number=1000&amp;tenpo_cd=400477">中古 状態難あり</a></td>
      <td><a href="/search?tenpo_code=400477">駿河屋日本橋本館の出品を見る</a></td>
    </tr></tbody></table>
  </body></html>`);

  assert.deepEqual(items, [
    {
      storeName: "駿河屋日本橋本館",
      condition: "中古 状態難あり",
      price: 5700,
    },
  ]);
});

test("最新の他店舗一覧をJSON一枚で保存する", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "pricewave-other-shop-"));
  try {
    const url = "https://www.suruga-ya.jp/product/detail/145070597";
    const checkedAt = new Date("2026-08-14T00:30:00.000Z");
    const saved = await syncOtherShopSnapshotFromProductHtml({
      surugayaUrl: url,
      checkedAt,
      rootDir,
      productHtml: `<!doctype html><html><body>
        <textarea id="pricewave-other-shops-data" data-state="ready"><table><tbody><tr><td>5,700円(税込)</td><td><a href="/product/detail/145070597?branch_number=1000&amp;amp;tenpo_cd=400477">中古 状態難あり</a></td><td><a href="/search?tenpo_code=400477">駿河屋日本橋本館の出品を見る</a></td></tr></tbody></table></textarea>
      </body></html>`,
    });

    assert.equal(saved.status, "saved");
    const data = await readOtherShopSnapshotData(url, rootDir);
    assert.equal(data?.capturedAt, checkedAt.toISOString());
    assert.equal(data?.items.length, 1);
    assert.equal(data?.items[0]?.price, 5700);
    assert.deepEqual(await readOtherShopSnapshotMetadata(url, rootDir), {
      productCode: "145070597",
      sourceUrl: "https://www.suruga-ya.jp/product/other/145070597",
      capturedAt: checkedAt.toISOString(),
      itemCount: 1,
    });
    assert.match(
      await readFile(otherShopSnapshotJsonPath("145070597", rootDir), "utf8"),
      /"items"/u,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("旧パーサが商品詳細表から作った誤スナップショットを読み出しとexportで除外する", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "pricewave-other-shop-legacy-"));
  const outputDirectory = path.join(rootDir, "viewer");
  try {
    const url = "https://www.suruga-ya.jp/product/detail/145045023";
    const snapshotPath = otherShopSnapshotJsonPath("145045023", rootDir);
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(
      snapshotPath,
      JSON.stringify({
        productCode: "145045023",
        sourceUrl: "https://www.suruga-ya.jp/product/other/145045023",
        capturedAt: "2026-08-17T15:27:55.587Z",
        items: [
          { storeName: "メーカー", condition: "中古 ：145045023001", price: 5280 },
          { storeName: "駿河屋柏青葉台店", condition: "ランクB", price: 22540 },
        ],
      }),
      "utf8",
    );

    const read = await readOtherShopSnapshotData(url, rootDir);
    assert.deepEqual(read?.items, [
      { storeName: "駿河屋柏青葉台店", condition: "ランクB", price: 22540 },
    ]);

    await exportOtherShopSnapshots(outputDirectory, rootDir);
    const exported = JSON.parse(
      await readFile(path.join(outputDirectory, "145045023.json"), "utf8"),
    ) as { items: Array<{ storeName: string }> };
    assert.deepEqual(exported.items.map((item) => item.storeName), ["駿河屋柏青葉台店"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("not_applicableなら構造化スナップショットを消す", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "pricewave-other-shop-clear-"));
  try {
    const url = "https://www.suruga-ya.jp/product/detail/145070597";
    await syncOtherShopSnapshotFromProductHtml({
      surugayaUrl: url,
      checkedAt: new Date("2026-08-14T00:30:00.000Z"),
      rootDir,
      productHtml: '<textarea id="pricewave-other-shops-data" data-state="ready"><table><tr><td>5,700円</td><td>中古</td><td>駿河屋</td></tr></table></textarea>',
    });
    const cleared = await syncOtherShopSnapshotFromProductHtml({
      surugayaUrl: url,
      checkedAt: new Date("2026-08-14T01:30:00.000Z"),
      rootDir,
      productHtml: '<textarea id="pricewave-other-shops-data" data-state="not_applicable"></textarea>',
    });
    assert.equal(cleared.status, "cleared");
    assert.equal(await readOtherShopSnapshotData(url, rootDir), null);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("拡張機能は /product/other/ を一回だけ取得する", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../browser-extension/manifest.json", import.meta.url), "utf8"),
  ) as { version?: string; permissions?: string[] };
  const content = await readFile(new URL("../browser-extension/content.js", import.meta.url), "utf8");
  const wrapper = await readFile(
    new URL("../browser-extension/fast-site-mode-wrapper.js", import.meta.url),
    "utf8",
  );

  assert.equal(manifest.version, "0.12.0");
  assert.ok(!manifest.permissions?.includes("declarativeNetRequestWithHostAccess"));
  assert.match(content, /pricewave-other-shops-data/u);
  assert.doesNotMatch(content, /pricewave-other-shops-mobile-data/u);
  assert.match(content, /pricewaveReadOtherShops/u);
  assert.doesNotMatch(content, /Promise\.allSettled/u);
  assert.doesNotMatch(content, /chrome\.runtime\.connect/u);
  assert.doesNotMatch(wrapper, /user-agent/iu);
  assert.doesNotThrow(() => new Function(content));
  assert.doesNotThrow(() => new Function(wrapper));
});

test("ローカル版とViewerは同じ取得データを画面幅で描き分ける", async () => {
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

  assert.match(component, /sourceType === "other_shop"/u);
  assert.match(component, /surugayaList/u);
  assert.doesNotMatch(component, /<iframe/u);
  assert.doesNotMatch(component, /mobileCapturedAt|desktopCapturedAt/u);
  assert.match(componentCss, /@media \(max-width: 720px\)/u);
  assert.match(componentCss, /grid-template-columns: 1fr auto/u);

  assert.match(viewer, /viewerJunkHistorySections/u);
  assert.match(viewer, /sourceType === 'other_shop'/u);
  assert.doesNotMatch(viewer, /<iframe/u);
  assert.doesNotMatch(viewer, /mobilePath|desktopPath/u);
  assert.match(viewerCss, /@media\(max-width:760px\)/u);
  assert.match(viewerCss, /grid-template-columns:1fr auto/u);
});

test("importとviewer exportは構造化JSONスナップショットへ接続する", async () => {
  const importRoute = await readFile(new URL("../app/api/import/route.ts", import.meta.url), "utf8");
  const exporter = await readFile(new URL("../scripts/export-viewer-data.ts", import.meta.url), "utf8");
  const apiRoute = await readFile(
    new URL("../app/api/other-shop-snapshot/[productCode]/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(importRoute, /syncOtherShopSnapshotFromProductHtml/u);
  assert.match(importRoute, /16 \* 1024 \* 1024/u);
  assert.match(exporter, /exportOtherShopSnapshots/u);
  assert.match(exporter, /data\/other-shops\/\$\{otherShopSnapshot\.productCode\}\.json/u);
  assert.doesNotMatch(exporter, /\.mobile\.html|desktopPath|mobilePath/u);
  assert.match(apiRoute, /readOtherShopSnapshotData/u);
  assert.match(apiRoute, /Response\.json/u);
});
