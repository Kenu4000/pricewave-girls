import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("拡張機能popup.jsを構文解析できる", () => {
  const source = readFileSync(
    new URL("../browser-extension/popup.js", import.meta.url),
    "utf8",
  );

  assert.doesNotThrow(() => new vm.Script(source, { filename: "popup.js" }));
});
