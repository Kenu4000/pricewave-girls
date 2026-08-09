import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/live-refresh.tsx", import.meta.url),
  "utf8",
);

test("自動更新完了時は一覧を強制リフレッシュして並べ直さない", () => {
  const start = source.indexOf("const finishIfDrained");
  const end = source.indexOf("const revealNext", start);
  assert.ok(start >= 0 && end > start);

  const finishBlock = source.slice(start, end);
  assert.doesNotMatch(finishBlock, /router\.refresh\s*\(/);
  assert.doesNotMatch(finishBlock, /\brefresh\s*\(/);
  assert.match(finishBlock, /finishedSessionsRef\.current\.delete\(sessionId\)/);
});
