import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("Prismaに巡回実行履歴とViewer公開結果を保存する", async () => {
  const schema = await text("prisma/schema.prisma");
  const migration = await text("prisma/migrations/20260904121000_add_crawl_runs/migration.sql");

  assert.match(schema, /model CrawlRun/u);
  assert.match(schema, /trigger\s+String/u);
  assert.match(schema, /succeeded\s+Int/u);
  assert.match(schema, /failed\s+Int/u);
  assert.match(schema, /viewerPublishStatus\s+String\?/u);
  assert.match(schema, /viewerPublishedAt\s+DateTime\?/u);
  assert.match(migration, /CREATE TABLE "CrawlRun"/u);
});

test("巡回履歴APIは開始・完了・Viewer公開状態を更新できる", async () => {
  const collection = await text("app/api/crawl-runs/route.ts");
  const item = await text("app/api/crawl-runs/[id]/route.ts");

  assert.match(collection, /prisma\.crawlRun\.create/u);
  assert.match(collection, /prisma\.crawlRun\.findMany/u);
  assert.match(item, /TERMINAL_STATUSES/u);
  assert.match(item, /finishedAt = new Date\(\)/u);
  assert.match(item, /viewerPublishStatus/u);
  assert.match(item, /viewerPublishedAt/u);
});

test("Edge巡回は全商品実行を1件の巡回履歴として記録する", async () => {
  const worker = await text("browser-extension/service-worker.js");
  const wrapper = await text("browser-extension/crawl-run-history-wrapper.js");

  assert.match(worker, /crawl-run-history-wrapper\.js/u);
  assert.match(wrapper, /const originalRunAllProducts = runAllProducts/u);
  assert.match(wrapper, /\/api\/crawl-runs/u);
  assert.match(wrapper, /crawlRunId/u);
  assert.match(wrapper, /status: state/u);
  assert.match(wrapper, /succeeded:/u);
  assert.match(wrapper, /failed:/u);
  assert.match(wrapper, /finally/u);
  assert.doesNotThrow(() => new Function(wrapper));
});

test("日次Viewer公開は完了した巡回履歴へ公開結果を関連付ける", async () => {
  const runner = await text("browser-extension/automation-runner.js");
  const publishRoute = await text("app/api/automation/publish-viewer/route.ts");

  assert.match(runner, /publishViewer\(response\.status\?\.crawlRunId \?\? null\)/u);
  assert.match(runner, /JSON\.stringify\(\{ crawlRunId \}\)/u);
  assert.match(publishRoute, /prisma\.crawlRun\.updateMany/u);
  assert.match(publishRoute, /viewerPublishStatus: status/u);
  assert.match(publishRoute, /viewerPublishedAt:/u);
});

test("ローカル画面から直近の巡回履歴を確認できる", async () => {
  const page = await text("app/crawl-runs/page.tsx");
  const layout = await text("app/layout.tsx");

  assert.match(page, /prisma\.crawlRun\.findMany/u);
  assert.match(page, /巡回履歴/u);
  assert.match(page, /所要時間/u);
  assert.match(page, /Viewer/u);
  assert.match(layout, /href="\/crawl-runs"/u);
});
