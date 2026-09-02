import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appSource = readFileSync(
  new URL("../viewer/app.js", import.meta.url),
  "utf8",
);
const htmlSource = readFileSync(
  new URL("../viewer/index.html", import.meta.url),
  "utf8",
);
const publisherSource = readFileSync(
  new URL("../scripts/publish-viewer.mjs", import.meta.url),
  "utf8",
);

test("GitHub Pages閲覧版のJavaScriptを構文解析できる", () => {
  assert.doesNotThrow(() => new vm.Script(appSource));
});

test("閲覧版はローカルAPIではなく静的JSONだけを読む", () => {
  assert.match(appSource, /\.\/data\/index\.json/u);
  assert.match(appSource, /\.\/data\/products\//u);
  assert.doesNotMatch(appSource, /\/api\//u);
  assert.doesNotMatch(appSource, /localhost:3000/u);
});

test("閲覧版HTMLはキャッシュキー付きでも相対パスで静的アセットを読む", () => {
  assert.match(htmlSource, /href="\.\/styles\.css(?:\?v=[^"]+)?"/u);
  assert.match(htmlSource, /src="\.\/app\.js(?:\?v=[^"]+)?"/u);
});

test("公開スクリプトは専用gh-pagesブランチだけをforce更新する", () => {
  assert.match(publisherSource, /HEAD:gh-pages/u);
  assert.match(publisherSource, /--force/u);
  assert.doesNotMatch(publisherSource, /HEAD:main/u);
});

test("Windowsではnpm.cmdをcmd.exe経由で起動する", () => {
  assert.match(publisherSource, /process\.platform === "win32"/u);
  assert.match(publisherSource, /process\.env\.ComSpec \|\| "cmd\.exe"/u);
  assert.match(publisherSource, /\["\/d", "\/s", "\/c", "npm\.cmd", \.\.\.args\]/u);
  assert.doesNotMatch(
    publisherSource,
    /const npmCommand = process\.platform === "win32" \? "npm\.cmd" : "npm"/u,
  );
});

test("公開スクリプトは子プロセス起動自体の失敗も報告する", () => {
  assert.match(publisherSource, /result\.error \|\| result\.status !== 0/u);
  assert.match(publisherSource, /result\.error\.message/u);
});
