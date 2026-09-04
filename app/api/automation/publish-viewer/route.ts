import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

function parseCrawlRunId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function recordViewerPublish(
  crawlRunId: number | null,
  status: "success" | "error",
  message: string | null,
) {
  if (crawlRunId === null) return;
  try {
    await prisma.crawlRun.updateMany({
      where: { id: crawlRunId },
      data: {
        viewerPublishStatus: status,
        viewerPublishedAt: status === "success" ? new Date() : undefined,
        viewerPublishMessage: message?.slice(-4000) || null,
      },
    });
  } catch (error) {
    console.error("巡回履歴へのViewer公開結果保存に失敗しました。", error);
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { crawlRunId?: unknown } | null;
  const crawlRunId = parseCrawlRunId(body?.crawlRunId);

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
      await recordViewerPublish(crawlRunId, "error", result.output || "viewer:publish が失敗しました。");
      return NextResponse.json(
        { ok: false, error: "Viewer公開に失敗しました。", output: result.output },
        { status: 500 },
      );
    }
    await recordViewerPublish(crawlRunId, "success", "viewer:publish 完了");
    return NextResponse.json({ ok: true, output: result.output });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Viewer公開に失敗しました。";
    await recordViewerPublish(crawlRunId, "error", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  } finally {
    globalForAutomation.pricewaveViewerPublishPromise = undefined;
  }
}
