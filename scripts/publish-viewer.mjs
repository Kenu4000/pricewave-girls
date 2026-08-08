import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "viewer-dist");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout || ""}` : "";
    throw new Error(`${command} ${args.join(" ")} に失敗しました。${detail}`);
  }
  return options.capture ? String(result.stdout || "").trim() : "";
}

async function main() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  run(npmCommand, ["run", "viewer:export"]);

  const origin = run("git", ["remote", "get-url", "origin"], { capture: true });
  if (!origin) throw new Error("Git remote origin が見つかりません。");

  const temp = await mkdtemp(path.join(tmpdir(), "pricewave-pages-"));
  try {
    await cp(OUTPUT_DIR, temp, { recursive: true });
    run("git", ["init"], { cwd: temp });
    run("git", ["checkout", "--orphan", "gh-pages"], { cwd: temp });
    run("git", ["add", "-A"], { cwd: temp });
    run(
      "git",
      [
        "-c",
        "user.name=Pricewave Viewer Publisher",
        "-c",
        "user.email=pricewave-viewer@users.noreply.github.com",
        "commit",
        "-m",
        `Update viewer snapshot ${new Date().toISOString()}`,
      ],
      { cwd: temp },
    );
    run("git", ["remote", "add", "origin", origin], { cwd: temp });
    run("git", ["push", "--force", "origin", "HEAD:gh-pages"], { cwd: temp });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }

  console.log("GitHub Pages用 gh-pages ブランチを最新スナップショットへ更新しました。");
  console.log("初回だけ GitHub > Settings > Pages で gh-pages / (root) を公開元に設定してください。");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
