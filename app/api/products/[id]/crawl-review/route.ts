import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "商品IDが不正です" }, { status: 400 });
  }

  const result = await prisma.product.updateMany({
    where: {
      id: productId,
      crawlIntervalDays: 1,
    },
    data: {
      crawlIntervalReviewedAt: new Date(),
    },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "商品が見つからないか、現在1日設定ではありません" },
      { status: 404 },
    );
  }

  return NextResponse.json({ id: productId, crawlIntervalDays: 1, reviewed: true });
}
