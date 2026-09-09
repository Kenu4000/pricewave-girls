import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  exportOtherShopSnapshots,
  OTHER_SHOP_SNAPSHOT_EXPORT_BATCH_SIZE,
  otherShopSnapshotDirectory,
} from "./other-shop-html-snapshot";

test("Viewer他店舗スナップショットは小さいバッチで全件出力する", async () => {
  assert.equal(OTHER_SHOP_SNAPSHOT_EXPORT_BATCH_SIZE, 32);

  const root = await mkdtemp(path.join(tmpdir(), "pricewave-other-shop-export-"));
  const source = otherShopSnapshotDirectory(root);
  const output = path.join(root, "viewer-dist", "data", "other-shops");

  try {
    await mkdir(source, { recursive: true });

    const count = OTHER_SHOP_SNAPSHOT_EXPORT_BATCH_SIZE * 3 + 5;
    for (let index = 0; index < count; index += 1) {
      const productCode = String(145900000 + index);
      await writeFile(
        path.join(source, `${productCode}.json`),
        JSON.stringify({
          productCode,
          sourceUrl: `https://www.suruga-ya.jp/product/other/${productCode}`,
          capturedAt: "2026-09-09T00:00:00.000Z",
          items: [{ storeName: "テスト店", condition: "中古", price: 1234 + index }],
        }),
        "utf8",
      );
    }

    await exportOtherShopSnapshots(output, root);

    const files = (await readdir(output)).sort();
    assert.equal(files.length, count);
    assert.equal(files[0], "145900000.json");
    assert.equal(files.at(-1), `${145900000 + count - 1}.json`);

    const first = JSON.parse(await readFile(path.join(output, files[0]), "utf8")) as {
      productCode: string;
      items: Array<{ price: number }>;
    };
    assert.equal(first.productCode, "145900000");
    assert.equal(first.items[0]?.price, 1234);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
