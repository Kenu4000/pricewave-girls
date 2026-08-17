import { NextResponse } from "next/server";
import { productCrawlUrl } from "@/lib/product-crawl-source";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: "商品IDが不正です" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { surugayaUrl: true, detailsJson: true },
  });
  if (!product) {
    return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({
    url: productCrawlUrl(product.surugayaUrl, product.detailsJson),
  });
}
