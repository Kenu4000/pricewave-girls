import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("商品HTML送信前に一つの他店舗一覧取得完了だけを待つ", async () => {
  const wrapper = await readFile(
    new URL("../browser-extension/snapshot-readiness-wrapper.js", import.meta.url),
    "utf8",
  );

  assert.match(wrapper, /pricewave-other-shops-data/u);
  assert.doesNotMatch(wrapper, /pricewave-other-shops-mobile-data/u);
  assert.match(wrapper, /ready/u);
  assert.match(wrapper, /error/u);
  assert.match(wrapper, /not_applicable/u);
  assert.match(wrapper, /22_000/u);
  assert.match(wrapper, /document\.documentElement\?\.outerHTML/u);
  assert.doesNotThrow(() => new Function(wrapper));
});

test("Service Workerは待機ラッパーを既存処理より先に読み込む", async () => {
  const serviceWorker = await readFile(
    new URL("../browser-extension/service-worker.js", import.meta.url),
    "utf8",
  );
  const manifest = JSON.parse(
    await readFile(new URL("../browser-extension/manifest.json", import.meta.url), "utf8"),
  ) as { version?: string; background?: { service_worker?: string } };

  assert.match(
    serviceWorker,
    /^importScripts\("snapshot-readiness-wrapper\.js", "fast-site-mode-wrapper\.js"\);/u,
  );
  assert.equal(manifest.version, "0.12.0");
  assert.equal(manifest.background?.service_worker, "service-worker.js");
});
