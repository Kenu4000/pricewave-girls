import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./product-import-sessions.ts", import.meta.url),
  "utf8",
);

test("自動更新の各商品はDB保存を完了して確認時刻付き専用ライブ通知へ流す", () => {
  assert.match(source, /productImportQueue\.enqueue\(input, \{ notify: false \}\)/u);
  assert.match(source, /notifyProductBatchSaved\(session\.id, session\.savedIds\.length, \[/u);
  assert.match(source, /lastCheckedAt: \(input\.checkedAt \?\? new Date\(\)\)\.toISOString\(\)/u);
  assert.doesNotMatch(source, /upsertProductSnapshotsWithTimeSale\(batch/u);
  assert.doesNotMatch(source, /pending:\s*new Map/u);
});

test("取込セッションはRoute Module間で共有され、長時間巡回中は失効しない", () => {
  assert.match(
    source,
    /globalForImportSessions\.productImportSessionsV3\s*=\s*sessions/u,
  );
  assert.match(source, /now - session\.lastTouchedAt >= SESSION_TTL_MS/u);
  assert.doesNotMatch(source, /now - session\.createdAt >= SESSION_TTL_MS/u);
});
