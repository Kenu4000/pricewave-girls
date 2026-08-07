import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSurugayaHtml } from "@/lib/surugaya-browser";
import { parseProductHtml } from "@/lib/surugaya";
import {
  detectPrimaryTimeSale,
  withTimeSaleStorageMarker,
} from "@/lib/time-sale";
import { upsertProductSnapshotsWithTimeSale } from "@/lib/time-sale-persistence";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isInteger(productId)) {
    return NextResponse.json({ error: "商品IDが不正です" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
  }

  try {
    const html = await fetchSurugayaHtml(product.surugayaUrl);
    const fetched = withTimeSaleStorageMarker(
      parseProductHtml(html),
      detectPrimaryTimeSale(html),
    );
    await upsertProductSnapshotsWithTimeSale([
      { surugayaUrl: product.surugayaUrl, fetched },
    ]);

    return NextResponse.json({ ok: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "価格更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
