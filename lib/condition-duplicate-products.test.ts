import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  conditionDuplicateIdentity,
  findConditionDuplicateProducts,
} from "./condition-duplicate-products";

const sakuraNormal = "サクラノ刻 [通常版]（Windows 10）";
const sakuraMissingArtwork =
  "サクラノ刻 [通常版](状態：オフィシャルアートワーク欠品)（Windows 10）";
const sakuraMissingMultiple =
  "サクラノ刻 [通常版](状態：オフィシャルアートワーク・ミニ色紙欠品、箱(内箱含む)状態難)（Windows 10）";

test("状態表記を除いた同一editionのランクBだけを重複削除候補にする", () => {
  const matches = findConditionDuplicateProducts([
    { id: 1, title: sakuraNormal, conditionRank: "A", condition: null },
    { id: 2, title: sakuraMissingArtwork, conditionRank: "B", condition: "オフィシャルアートワーク欠品" },
    { id: 3, title: sakuraMissingMultiple, conditionRank: "B", condition: "オフィシャルアートワーク・ミニ色紙欠品、箱(内箱含む)状態難" },
    { id: 4, title: "サクラノ刻 [初回限定版]（Windows 10）", conditionRank: "A", condition: null },
    { id: 5, title: "サクラノ刻 [初回限定版](状態：冊子欠品)（Windows 10）", conditionRank: "B", condition: "冊子欠品" },
  ]);

  assert.deepEqual(matches.map((match) => match.product.id), [2, 3]);
  assert.deepEqual(matches.map((match) => match.normalProductIds), [[1], [1]]);
});

test("DBのconditionだけでランクBになっている同名カードも削除候補にする", () => {
  const matches = findConditionDuplicateProducts([
    { id: 10, title: sakuraNormal, conditionRank: "A", condition: null },
    { id: 11, title: sakuraNormal, conditionRank: "B", condition: "ミニ色紙欠品" },
  ]);

  assert.deepEqual(matches.map((match) => match.product.id), [11]);
});

test("通常版と廉価版などeditionが違う状態A商品は重複扱いしない", () => {
  const matches = findConditionDuplicateProducts([
    { id: 20, title: "戦国ランス", conditionRank: "A", condition: null },
    { id: 21, title: "戦国ランス 廉価版", conditionRank: "A", condition: null },
  ]);

  assert.deepEqual(matches, []);
  assert.notEqual(conditionDuplicateIdentity("戦国ランス"), conditionDuplicateIdentity("戦国ランス 廉価版"));
});

test("状態違い重複削除コマンドはpreviewが既定でapply時だけ削除する", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const script = await readFile("scripts/delete-condition-duplicate-products.ts", "utf8");

  assert.match(packageJson.scripts["cleanup:condition-duplicates"], /delete-condition-duplicate-products\.ts/u);
  assert.match(script, /process\.argv\.includes\("--apply"\)/u);
  assert.match(script, /if \(!apply\)/u);
  assert.match(script, /findConditionDuplicateProducts/u);
  assert.match(script, /DELETE_CHUNK_SIZE = 400/u);
  assert.match(script, /prisma\.product\.deleteMany/u);
});
