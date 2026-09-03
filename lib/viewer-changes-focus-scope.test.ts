import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewer価格変更の通常範囲は注目メーカーまたは1日・3日巡回にする", async () => {
  const source = await readFile(
    new URL("../viewer/changes-main-ui.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /function isOneOrThreeDays\(product\)/u);
  assert.match(source, /days === 1 \|\| days === 3/u);
  assert.match(
    source,
    /featured\.has\(normalizeBrand\(product\.manufacturer\)\) \|\| isOneOrThreeDays\(product\)/u,
  );
  assert.doesNotMatch(source, /days >= 3/u);
  assert.match(source, /注目メーカー＋1・3日/u);
});
