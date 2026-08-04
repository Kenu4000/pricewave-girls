import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchProduct,
  InvalidSurugayaUrlError,
  normalizeSurugayaUrl,
} from "@/lib/surugaya";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "URLを入力してください" }, { status: 400 });
    }

    const normalizedUrl = normalizeSurugayaUrl(url);
    const fetched = await fetchProduct(normalizedUrl);
    const product = await prisma.product.upsert({
      where: { surugayaUrl: normalizedUrl },
      update: {
        title: fetched.title,
        imageUrl: fetched.imageUrl,
        latestSalePrice: fetched.salePrice,
        latestBuyPrice: fetched.buyPrice,
        stockStatus: fetched.stockStatus,
        histories: {
          create: {
            salePrice: fetched.salePrice,
            buyPrice: fetched.buyPrice,
            stockStatus: fetched.stockStatus,
          },
        },
      },
      create: {
        title: fetched.title,
        surugayaUrl: normalizedUrl,
        imageUrl: fetched.imageUrl,
        latestSalePrice: fetched.salePrice,
        latestBuyPrice: fetched.buyPrice,
        stockStatus: fetched.stockStatus,
        histories: {
          create: {
            salePrice: fetched.salePrice,
            buyPrice: fetched.buyPrice,
            stockStatus: fetched.stockStatus,
          },
        },
      },
    });

    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "商品の追加に失敗しました";
    const status = caught instanceof InvalidSurugayaUrlError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
