import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const ROOT = process.cwd();

async function text(path: string) {
  return readFile(`${ROOT}/${path}`, "utf8");
}

test("拡張の価格推移パネルを構文解析できる", async () => {
  const source = await text("browser-extension/price-history-panel.js");
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /Pricewave 価格推移/u);
  assert.match(source, /日（全期間）/u);
  assert.match(source, /販売価格/u);
  assert.match(source, /買取価格/u);
  assert.match(source, /ランクB/u);
  assert.match(source, /タイムセール/u);
  assert.match(source, /商品詳細情報/u);
  assert.match(source, /pointermove/u);
  assert.match(source, /currentReadout/u);
});

test("拡張manifestは駿河屋商品詳細で価格推移JSとCSSを読み込む", async () => {
  const manifest = JSON.parse(await text("browser-extension/manifest.json")) as {
    version: string;
    content_scripts?: Array<{ js?: string[]; css?: string[] }>;
  };
  assert.equal(manifest.version, "0.12.0");
  assert.ok(manifest.content_scripts?.[0]?.js?.includes("price-history-panel.js"));
  assert.ok(manifest.content_scripts?.[0]?.css?.includes("price-history-panel.css"));
});

test("service workerは商品コードからローカル価格履歴APIを取得する", async () => {
  const source = await text("browser-extension/service-worker.js");
  assert.match(source, /pricewave:history/u);
  assert.match(source, /\/api\/surugaya-history\//u);
  assert.match(source, /localhost:3000/u);
});

test("価格履歴APIは同一タイトル商品を含めてグラフ履歴を返す", async () => {
  const source = await text("app/api/surugaya-history/[productCode]/route.ts");
  assert.match(source, /productCodeFromUrl/u);
  assert.match(source, /title: product\.title/u);
  assert.match(source, /relatedProducts/u);
  assert.match(source, /regularSalePrice/u);
  assert.match(source, /conditionRank/u);
  assert.match(source, /isTimeSale/u);
});
