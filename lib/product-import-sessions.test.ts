import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./product-import-sessions.ts", import.meta.url),
  "utf8",
);

test("自動更新の各商品は手動記録と同じimport queueでDB保存を完了してから成功扱いになる", () => {
  assert.match(source, /productImportQueue\.enqueue\(input\)/u);
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
