import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("日次タスクは休止中のPCを起こして対話セッションで実行する", async () => {
  const installer = await readFile(
    new URL("../scripts/install-pricewave-scheduled-task.ps1", import.meta.url),
    "utf8",
  );

  assert.match(installer, /-WakeToRun/u);
  assert.match(installer, /-StartWhenAvailable/u);
  assert.match(installer, /-LogonType Interactive/u);
  assert.match(installer, /start-pricewave-daily\.ps1/u);
  assert.match(installer, /-NoVSCode/u);
});

test("無人日次実行ではVS Codeを起動しない指定を受け付ける", async () => {
  const runner = await readFile(
    new URL("../scripts/start-pricewave-daily.ps1", import.meta.url),
    "utf8",
  );

  assert.match(runner, /\[switch\]\$NoVSCode/u);
  assert.match(runner, /if \(-not \$NoVSCode\)/u);
});
