import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("価格変更一覧で値上げ・値下がりを種類の横に矢印表示する", async () => {
  const page = await readFile(new URL("../app/changes/page.tsx", import.meta.url), "utf8");
  const css = await readFile(
    new URL("../app/changes/PriceChanges.module.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /return currentPrice > previousPrice \? "up" : "down"/u);
  assert.match(page, /return "↑"/u);
  assert.match(page, /return "↓"/u);
  assert.match(page, /styles\.typeWithDirection/u);
  assert.match(page, /styles\.directionArrow/u);
  assert.match(css, /\.directionArrow/u);
  assert.match(css, /\.up/u);
  assert.match(css, /\.down/u);
});

test("ランクB商品の価格変更行をランクB色の薄緑背景にする", async () => {
  const page = await readFile(new URL("../app/changes/page.tsx", import.meta.url), "utf8");
  const events = await readFile(new URL("./price-change-events.ts", import.meta.url), "utf8");
  const css = await readFile(
    new URL("../app/changes/PriceChanges.module.css", import.meta.url),
    "utf8",
  );

  assert.match(events, /conditionRank: true/u);
  assert.match(events, /conditionRank: row\.product\.conditionRank/u);
  assert.match(page, /event\.conditionRank === "B"/u);
  assert.match(page, /styles\.rankBRow/u);
  assert.match(css, /\.rankBRow/u);
  assert.match(css, /#16a34a/u);
  assert.match(css, /color-mix\(in srgb, #16a34a 9%, white\)/u);
});
