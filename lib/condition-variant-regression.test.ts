import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { buildSeriesProductGroups, findProductSeries } from "./series-catalog";
import { splitProductTitleCondition } from "./product-title-condition";

const require = createRequire(import.meta.url);
const discoveryPolicy = require("../browser-extension/new-product-discovery-policy.js") as {
  isConditionVariantTitle(value: string | null | undefined): boolean;
  selectReleaseDiscoveryProducts(
    products: Array<{ url: string; releaseDate: string | null; title?: string | null }>,
    registeredIds: Set<string>,
    today: string,
  ): {
    products: Array<{ id: string; url: string; releaseDate: string | null }>;
    skippedCondition: number;
  };
};

const conditionVariantA =
  "サクラノ刻 [通常版](状態：オフィシャルアートワーク欠品)（Windows 10）";
const conditionVariantB =
  "サクラノ刻 [通常版](状態：オフィシャルアートワーク・ミニ色紙欠品、箱(内箱含む)状態難)（Windows 10）";

test("状態括弧の後ろに機種表記があっても状態違いとして分離する", () => {
  assert.deepEqual(splitProductTitleCondition(conditionVariantA), {
    title: "サクラノ刻 [通常版]（Windows 10）",
    condition: "オフィシャルアートワーク欠品",
    conditionRank: "B",
  });
  assert.deepEqual(splitProductTitleCondition(conditionVariantB), {
    title: "サクラノ刻 [通常版]（Windows 10）",
    condition: "オフィシャルアートワーク・ミニ色紙欠品、箱(内箱含む)状態難",
    conditionRank: "B",
  });
});

test("状態違いは通常品があるシリーズで別editionとして数えない", () => {
  const normalTitle = "サクラノ刻 [通常版]（Windows 10）";
  const series = findProductSeries(normalTitle);
  assert.ok(series);

  const groups = buildSeriesProductGroups(series, [
    { id: 1, title: normalTitle },
    { id: 2, title: conditionVariantA },
    { id: 3, title: conditionVariantB },
  ]);
  const sakuraGroups = groups.filter((group) => group.productIds.some((id) => [1, 2, 3].includes(id)));

  assert.deepEqual(sakuraGroups.flatMap((group) => group.productIds), [1]);
});

test("自動追加探索では明示的な状態違い商品を候補から除外する", () => {
  assert.equal(discoveryPolicy.isConditionVariantTitle(conditionVariantA), true);
  assert.equal(discoveryPolicy.isConditionVariantTitle(conditionVariantB), true);
  assert.equal(discoveryPolicy.isConditionVariantTitle("サクラノ刻 [通常版]（Windows 10）"), false);

  const result = discoveryPolicy.selectReleaseDiscoveryProducts(
    [
      {
        url: "https://www.suruga-ya.jp/product/detail/145077883",
        releaseDate: "2026/08/01",
        title: conditionVariantA,
      },
      {
        url: "https://www.suruga-ya.jp/product/detail/145078142",
        releaseDate: "2026/08/01",
        title: conditionVariantB,
      },
      {
        url: "https://www.suruga-ya.jp/product/detail/145000001",
        releaseDate: "2026/08/01",
        title: "サクラノ刻 [通常版]（Windows 10）",
      },
    ],
    new Set(),
    "2026-09-04",
  );

  assert.deepEqual(result.products.map((product) => product.id), ["145000001"]);
  assert.equal(result.skippedCondition, 2);
});
