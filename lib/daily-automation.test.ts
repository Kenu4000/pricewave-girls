import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function text(path: string) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("拡張機能がlocalhost自動実行ページから巡回を開始し完了後Viewerを公開する", async () => {
  const manifest = await text("browser-extension/manifest.json");
  const runner = await text("browser-extension/automation-runner.js");

  assert.match(manifest, /automation\/run/u);
  assert.match(manifest, /automation-runner\.js/u);
  assert.match(runner, /auto:run-now/u);
  assert.match(runner, /auto:get/u);
  assert.match(runner, /api\/automation\/publish-viewer/u);
  assert.match(runner, /state === "completed"/u);
});

test("Viewer公開APIは既存viewer:publishを利用する", async () => {
  const route = await text("app/api/automation/publish-viewer/route.ts");
  assert.match(route, /\["run", "viewer:publish"\]/u);
  assert.match(route, /pricewaveViewerPublishPromise/u);
});

test("WindowsランチャーはVS Code・dev server・Edge自動実行ページを起動する", async () => {
  const launcher = await text("scripts/start-pricewave-daily.ps1");
  const wrapper = await text("scripts/start-pricewave-daily.cmd");

  assert.match(launcher, /code\.(?:cmd|exe)/u);
  assert.match(launcher, /npm\.cmd run dev/u);
  assert.match(launcher, /msedge\.exe/u);
  assert.match(launcher, /\/automation\/run\?run=/u);
  assert.match(wrapper, /ExecutionPolicy Bypass/u);
});
