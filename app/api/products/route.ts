import { NextResponse } from "next/server";
import {
  crawlPriorityForProduct,
  isDailyCrawlProductTitle,
  productBrandCandidates,
} from "@/lib/crawl-brand-priority";
import { prisma } from "@/lib/prisma";
import { pruneProductPriceHistories } from "@/lib/price-history-retention";
import { fetchSurugayaHtml } from "@/lib/surugaya-browser";
import {
  InvalidSurugayaUrlError,
  normalizeSurugayaUrl,
  parseProductHtml,
} from "@/lib/surugaya";
import {
  detectPrimaryTimeSale,
  withTimeSaleStorageMarker,
} from "@/lib/time-sale";
import { upsertProductSnapshotsWithTimeSale } from "@/lib/time-sale-persistence";

export const runtime = "nodejs";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      surugayaUrl: true,
      manufacturer: true,
      detailsJson: true,
    },
  });

  return NextResponse.json({
    products: products.map((product) => {
      const brandCandidates = productBrandCandidates(
        product.manufacturer,
        product.detailsJson,
      );
      return {
        id: product.id,
        title: product.title,
        url: product.surugayaUrl,
        brand: brandCandidates[0] ?? null,
        brands: brandCandidates,
        dailyByTitle: isDailyCrawlProductTitle(product.title),
        crawlPriority: crawlPriorityForProduct(
          product.title,
          product.manufacturer,
          product.detailsJson,
        ),
      };
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "URLを入力してください" }, { status: 400 });
    }

    const normalizedUrl = normalizeSurugayaUrl(url);
    const html = await fetchSurugayaHtml(normalizedUrl);
    const fetched = withTimeSaleStorageMarker(
      parseProductHtml(html),
      detectPrimaryTimeSale(html),
    );
    const [product] = await upsertProductSnapshotsWithTimeSale([
      { surugayaUrl: normalizedUrl, fetched },
    ]);
    if (!product) throw new Error("商品の保存に失敗しました");
    await pruneProductPriceHistories([product.id]);

    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "商品の追加に失敗しました";
    const status = caught instanceof InvalidSurugayaUrlError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
