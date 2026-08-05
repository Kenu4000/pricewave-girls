import { NextResponse } from "next/server";
import { notifyProductsChanged } from "@/lib/product-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const priceChangeId = Number(id);

  if (!Number.isInteger(priceChangeId) || priceChangeId < 1) {
    return NextResponse.json(
      { error: "価格変更IDが不正です" },
      { status: 400 },
    );
  }

  const deleted = await prisma.$transaction(async (transaction) => {
    const priceChange = await transaction.priceChange.findUnique({
      where: { id: priceChangeId },
      select: { id: true, productId: true, type: true },
    });

    if (!priceChange) return null;

    await transaction.priceChange.delete({ where: { id: priceChangeId } });

    if (priceChange.type === "sale" || priceChange.type === "buy") {
      const latestRemainingChange = await transaction.priceChange.findFirst({
        where: {
          productId: priceChange.productId,
          type: priceChange.type,
        },
        orderBy: [{ changedAt: "desc" }, { id: "desc" }],
        select: { changedAt: true },
      });

      await transaction.product.update({
        where: { id: priceChange.productId },
        data:
          priceChange.type === "sale"
            ? { salePriceChangedAt: latestRemainingChange?.changedAt ?? null }
            : { buyPriceChangedAt: latestRemainingChange?.changedAt ?? null },
      });
    }

    return priceChange;
  });

  if (!deleted) {
    return NextResponse.json(
      { error: "削除対象の価格変更が見つかりません" },
      { status: 404 },
    );
  }

  notifyProductsChanged();
  return NextResponse.json({ ok: true });
}
