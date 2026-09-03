import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishResult = {
  code: number;
  output: string;
};

const globalForAutomation = globalThis as unknown as {
  pricewaveViewerPublishPromise?: Promise<PublishResult>;
};

function runViewerPublish(): Promise<PublishResult> {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["run", "viewer:publish"], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      windowsHide: true,
    });

    let output = "";
    const append = (chunk: Buffer | string) => {
      output += String(chunk);
      if (output.length > 40_000) output = output.slice(-40_000);
    };

    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

export async function POST() {
  if (globalForAutomation.pricewaveViewerPublishPromise) {
    return NextResponse.json(
      { ok: false, error: "Viewer公開はすでに実行中です。" },
      { status: 409 },
    );
  }

  const promise = runViewerPublish();
  globalForAutomation.pricewaveViewerPublishPromise = promise;

  try {
    const result = await promise;
    if (result.code !== 0) {
      return NextResponse.json(
        { ok: false, error: "Viewer公開に失敗しました。", output: result.output },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, output: result.output });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Viewer公開に失敗しました。",
      },
      { status: 500 },
    );
  } finally {
    globalForAutomation.pricewaveViewerPublishPromise = undefined;
  }
}
