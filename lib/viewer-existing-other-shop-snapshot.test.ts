import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewerは公開済みの旧他店舗HTMLを構造化表示へ再利用する", async () => {
  const viewer = await readFile(
    new URL("../viewer/other-shop-embed.js", import.meta.url),
    "utf8",
  );

  assert.match(viewer, /new DOMParser\(\)/u);
  assert.match(viewer, /data\/other-shops\/\$\{encodeURIComponent\(snapshot\.productCode\)\}\.html/u);
  assert.match(viewer, /viewerLegacyOtherShopItems/u);
  assert.match(viewer, /snapshot\?\.desktopCapturedAt/u);
  assert.match(viewer, /await viewerOtherShopSection\(detail\)/u);
  assert.doesNotMatch(viewer, /\.mobile\.html/u);
  assert.doesNotThrow(() => new Function(viewer));
});
