import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function productCodeFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return url.pathname.match(/^\/product\/detail\/([0-9A-Za-z]+)\/?$/u)?.[1] ?? null;
  } catch {
    return null;
  }
}

type HistoryRow = {
  id: number;
  productId: number;
  checkedAt: string;
  salePrice: number | null;
  regularSalePrice: number | null;
  buyPrice: number | null;
  stockStatus: string | null;
  condition: string | null;
  conditionRank: string | null;
  isTimeSale: boolean;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productCode: string }> },
) {
  const { productCode: rawProductCode } = await params;
  const productCode = rawProductCode.trim();
  if (!/^[0-9A-Za-z]+$/u.test(productCode)) {
    return NextResponse.json({ error: "商品コードが不正です。" }, { status: 400 });
  }

  const candidates = await prisma.product.findMany({
    where: { surugayaUrl: { contains: `/product/detail/${productCode}` } },
    include: { histories: { orderBy: [{ checkedAt: "asc" }, { id: "asc" }] } },
  });
  const product = candidates.find(
    (candidate) => productCodeFromUrl(candidate.surugayaUrl) === productCode,
  );
  if (!product) {
    return NextResponse.json({ error: "追跡中の商品ではありません。" }, { status: 404 });
  }

  const relatedProducts = await prisma.product.findMany({
    where: { title: product.title, id: { not: product.id } },
    select: {
      id: true,
      condition: true,
      conditionRank: true,
      histories: { orderBy: [{ checkedAt: "asc" }, { id: "asc" }] },
    },
  });

  const histories: HistoryRow[] = [
    ...product.histories.map((history) => ({
      id: history.id,
      productId: product.id,
      checkedAt: history.checkedAt.toISOString(),
      salePrice: history.salePrice,
      regularSalePrice: history.regularSalePrice,
      buyPrice: history.buyPrice,
      stockStatus: history.stockStatus,
      condition: history.condition ?? product.condition,
      conditionRank: history.conditionRank ?? product.conditionRank,
      isTimeSale: history.isTimeSale,
    })),
    ...relatedProducts.flatMap((relatedProduct) =>
      relatedProduct.histories.map((history) => ({
        id: history.id,
        productId: relatedProduct.id,
        checkedAt: history.checkedAt.toISOString(),
        salePrice: history.salePrice,
        regularSalePrice: history.regularSalePrice,
        buyPrice: history.buyPrice,
        stockStatus: history.stockStatus,
        condition: history.condition ?? relatedProduct.condition,
        conditionRank: history.conditionRank ?? relatedProduct.conditionRank,
        isTimeSale: history.isTimeSale,
      })),
    ),
  ].sort(
    (left, right) =>
      new Date(left.checkedAt).getTime() - new Date(right.checkedAt).getTime() ||
      left.productId - right.productId ||
      left.id - right.id,
  );

  return NextResponse.json(
    {
      product: {
        id: product.id,
        title: product.title,
        surugayaUrl: product.surugayaUrl,
      },
      histories,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
