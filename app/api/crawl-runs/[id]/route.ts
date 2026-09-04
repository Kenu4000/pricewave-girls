import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const RUN_STATUSES = new Set(["running", "completed", "blocked", "cancelled", "error"]);
const TERMINAL_STATUSES = new Set(["completed", "blocked", "cancelled", "error"]);
const VIEWER_STATUSES = new Set(["success", "error"]);

function nonNegativeInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
}

function optionalText(value: unknown, maxLength = 1000) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLength) || null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "巡回実行IDが不正です" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "更新内容が不正です" }, { status: 400 });

  const data: {
    status?: string;
    total?: number;
    succeeded?: number;
    failed?: number;
    message?: string | null;
    finishedAt?: Date;
    viewerPublishStatus?: string;
    viewerPublishedAt?: Date;
    viewerPublishMessage?: string | null;
  } = {};

  if (typeof body.status === "string") {
    if (!RUN_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "巡回状態が不正です" }, { status: 400 });
    }
    data.status = body.status;
    if (TERMINAL_STATUSES.has(body.status)) data.finishedAt = new Date();
  }

  for (const key of ["total", "succeeded", "failed"] as const) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const value = nonNegativeInteger(body[key]);
    if (value === undefined) {
      return NextResponse.json({ error: `${key}が不正です` }, { status: 400 });
    }
    data[key] = value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "message")) {
    const message = optionalText(body.message);
    if (message === undefined) {
      return NextResponse.json({ error: "messageが不正です" }, { status: 400 });
    }
    data.message = message;
  }

  if (Object.prototype.hasOwnProperty.call(body, "viewerPublishStatus")) {
    if (typeof body.viewerPublishStatus !== "string" || !VIEWER_STATUSES.has(body.viewerPublishStatus)) {
      return NextResponse.json({ error: "Viewer公開状態が不正です" }, { status: 400 });
    }
    data.viewerPublishStatus = body.viewerPublishStatus;
    if (body.viewerPublishStatus === "success") data.viewerPublishedAt = new Date();
  }

  if (Object.prototype.hasOwnProperty.call(body, "viewerPublishMessage")) {
    const message = optionalText(body.viewerPublishMessage, 4000);
    if (message === undefined) {
      return NextResponse.json({ error: "Viewer公開メッセージが不正です" }, { status: 400 });
    }
    data.viewerPublishMessage = message;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
  }

  try {
    const run = await prisma.crawlRun.update({ where: { id: runId }, data });
    return NextResponse.json(run);
  } catch {
    return NextResponse.json({ error: "巡回実行履歴が見つかりません" }, { status: 404 });
  }
}
