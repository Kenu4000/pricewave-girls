import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const viewerScriptUrl = new URL("../viewer/brand-featured-options.js", import.meta.url);

test("Viewerの詳細検索ブランド一覧はmainと同じ区分と別名統合を使う", async () => {
  const viewer = await readFile(viewerScriptUrl, "utf8");
  const mainAliases = await readFile(
    new URL("../lib/brand-aliases.ts", import.meta.url),
    "utf8",
  );

  assert.match(viewer, /FEATURED_LIMIT = 20/u);
  assert.match(viewer, /よく登録されているメーカー/u);
  assert.match(viewer, /五十音順/u);
  assert.match(viewer, /巡回停止/u);
  assert.match(viewer, /製品数が多い順/u);
  assert.match(viewer, /brand-product-count/u);
  assert.match(viewer, /profile\.active === 0/u);
  assert.match(viewer, /profile\.active > 0/u);
  assert.match(viewer, /resolveBrandIdentity\(product\.manufacturer\)\.key === selectedKey/u);
  assert.match(viewer, /mainBrandCountOrder/u);

  for (const alias of [
    "ALICESOFT（アリスソフト）",
    "Purple software（パープルソフトウェア）",
    "AQUAPLUS（アクアプラス）",
    "あかべぇそふとつぅ",
    "Littlewitch（リトルウィッチ）",
  ]) {
    assert.ok(mainAliases.includes(alias), `mainに ${alias} がある`);
    assert.ok(viewer.includes(alias), `Viewerにも ${alias} がある`);
  }
});

test("Viewerブランド一覧スクリプトはJavaScriptとして構文エラーがない", () => {
  execFileSync(process.execPath, ["--check", fileURLToPath(viewerScriptUrl)], {
    stdio: "pipe",
  });
});

test("Viewerはブランド一覧の新しいスクリプトを読み込む", async () => {
  const index = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
  assert.match(index, /brand-featured-options\.js\?v=202609041107/u);
});
