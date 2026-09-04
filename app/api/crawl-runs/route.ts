import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeTrigger(value: unknown) {
  if (typeof value !== "string") return "unknown";
  const trigger = value.trim().slice(0, 40);
  return trigger || "unknown";
}

export async function GET() {
  const runs = await prisma.crawlRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { trigger?: unknown } | null;
  const run = await prisma.crawlRun.create({
    data: { trigger: normalizeTrigger(body?.trigger) },
    select: { id: true, startedAt: true },
  });
  return NextResponse.json(run, { status: 201 });
}
