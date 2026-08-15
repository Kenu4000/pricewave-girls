import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseIds(raw: string | null): number[] {
  return [...new Set(
    (raw ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )].slice(0, 200);
}

export async function GET(request: Request) {
  const ids = parseIds(new URL(request.url).searchParams.get("ids"));
  if (ids.length === 0) return NextResponse.json({ intervals: {} });

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, crawlIntervalDays: true },
  });

  return NextResponse.json({
    intervals: Object.fromEntries(
      products.map((product) => [product.id, product.crawlIntervalDays]),
    ),
  });
}
