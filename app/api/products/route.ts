import { NextResponse } from "next/server";
import { isRecentDailyCrawlBrand } from "@/lib/crawl-brand-priority-recent";
import { crawlPriorityForProduct, productBrandCandidates } from "@/lib/crawl-brand-priority";
import { prisma } from "@/lib/prisma";
import { pruneProductPriceHistories } from "@/lib/price-history-retention";
import { upsertProductSnapshot } from "@/lib/product-snapshots";
import {
  fetchProduct,
  InvalidSurugayaUrlError,
  normalizeSurugayaUrl,
} from "@/lib/surugaya";

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
      const basePriority = crawlPriorityForProduct(
        product.manufacturer,
        product.detailsJson,
      );
      return {
        id: product.id,
        title: product.title,
        url: product.surugayaUrl,
        brand: brandCandidates[0] ?? null,
        crawlPriority:
          basePriority === "daily" || isRecentDailyCrawlBrand(brandCandidates)
            ? "daily"
            : "rotation",
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
    const fetched = await fetchProduct(normalizedUrl);
    const product = await upsertProductSnapshot(normalizedUrl, fetched);
    await pruneProductPriceHistories([product.id]);

    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "商品の追加に失敗しました";
    const status = caught instanceof InvalidSurugayaUrlError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
