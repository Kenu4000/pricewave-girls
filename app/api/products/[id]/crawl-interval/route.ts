import { NextResponse } from "next/server";
import { parseCrawlIntervalDays } from "@/lib/crawl-interval";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "商品IDが不正です" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { crawlIntervalDays?: unknown } | null;
  const crawlIntervalDays = parseCrawlIntervalDays(body?.crawlIntervalDays);
  if (crawlIntervalDays === undefined) {
    return NextResponse.json(
      { error: "巡回周期は1日・3日・7日・14日・無のいずれかを指定してください" },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.update({
      where: { id: productId },
      data: { crawlIntervalDays },
      select: { id: true, crawlIntervalDays: true },
    });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
  }
}
