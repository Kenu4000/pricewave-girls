import { NextResponse } from "next/server";
import { parseCrawlIntervalDays } from "@/lib/crawl-interval";
import { buildProductFilterCatalog } from "@/lib/product-filter-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    brand?: unknown;
    crawlIntervalDays?: unknown;
  } | null;
  const brand = typeof body?.brand === "string" ? body.brand.trim() : "";
  const crawlIntervalDays = parseCrawlIntervalDays(body?.crawlIntervalDays);

  if (!brand) {
    return NextResponse.json({ error: "ブランドを指定してください" }, { status: 400 });
  }
  if (crawlIntervalDays === undefined) {
    return NextResponse.json(
      { error: "巡回周期は1日・3日・7日・14日・無のいずれかを指定してください" },
      { status: 400 },
    );
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      manufacturer: true,
      releaseDate: true,
      category: true,
      detailsJson: true,
    },
  });
  const catalog = buildProductFilterCatalog(products);
  const productIds = catalog.brands.productIds.get(brand) ?? [];

  if (productIds.length === 0) {
    return NextResponse.json({ error: "対象ブランドの商品が見つかりません" }, { status: 404 });
  }

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { crawlIntervalDays },
  });

  return NextResponse.json({
    brand,
    crawlIntervalDays,
    count: result.count,
  });
}
