import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("mainからGitHubのOpen Issueを取得しPRは除外する", async () => {
  const issues = await source("./github-issues.ts");
  assert.match(
    issues,
    /https:\/\/api\.github\.com\/repos\/\$\{REPOSITORY\}\/issues\?state=open/u,
  );
  assert.match(issues, /issue\.pull_request === undefined/u);
  assert.match(issues, /cache: "no-store"/u);
  assert.match(issues, /process\.env\.GITHUB_TOKEN/u);
});

test("リクエスト画面でIssue本文とGitHubへの導線を表示する", async () => {
  const page = await source("../app/requests/page.tsx");
  assert.match(page, /<h1>リクエスト<\/h1>/u);
  assert.match(page, /issue\.body/u);
  assert.match(page, /GitHubで開く/u);
  assert.match(page, /Issueを取得できませんでした/u);
  assert.match(page, /未処理リクエストはありません/u);
});

test("共通ヘッダーからリクエスト画面へ移動できる", async () => {
  const layout = await source("../app/layout.tsx");
  assert.match(layout, /href="\/requests">リクエスト<\/a>/u);
});
