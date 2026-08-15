import { NextResponse } from "next/server";
import { parseCrawlIntervalDays } from "@/lib/crawl-interval";
import { buildProductFilterCatalog } from "@/lib/product-filter-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SourceProduct = {
  id: number;
  manufacturer: string | null;
  releaseDate: string | null;
  category: string | null;
  detailsJson: string | null;
  crawlIntervalDays: number | null;
};

async function loadBrandTarget(brand: string) {
  const products: SourceProduct[] = await prisma.product.findMany({
    select: {
      id: true,
      manufacturer: true,
      releaseDate: true,
      category: true,
      detailsJson: true,
      crawlIntervalDays: true,
    },
  });
  const catalog = buildProductFilterCatalog(products);
  const productIds = catalog.brands.productIds.get(brand) ?? [];
  const option = [
    ...catalog.brands.options.featured,
    ...catalog.brands.options.alphabetical,
  ].find((candidate) => candidate.value === brand);
  const intervalById = new Map(products.map((product) => [product.id, product.crawlIntervalDays]));
  const intervals = productIds.map((id) => intervalById.get(id) ?? 1);
  const uniform = intervals.length > 0 && intervals.every((value) => value === intervals[0]);

  return {
    label: option?.label ?? brand,
    productIds,
    uniform,
    crawlIntervalDays: uniform ? intervals[0] : null,
  };
}

export async function GET(request: Request) {
  const brand = new URL(request.url).searchParams.get("brand")?.trim() ?? "";
  if (!brand) {
    return NextResponse.json({ error: "ブランドを指定してください" }, { status: 400 });
  }

  const target = await loadBrandTarget(brand);
  if (target.productIds.length === 0) {
    return NextResponse.json({ error: "対象ブランドの商品が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({
    brand,
    label: target.label,
    count: target.productIds.length,
    uniform: target.uniform,
    crawlIntervalDays: target.crawlIntervalDays,
  });
}

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

  const target = await loadBrandTarget(brand);
  if (target.productIds.length === 0) {
    return NextResponse.json({ error: "対象ブランドの商品が見つかりません" }, { status: 404 });
  }

  const result = await prisma.product.updateMany({
    where: { id: { in: target.productIds } },
    data: { crawlIntervalDays },
  });

  return NextResponse.json({
    brand,
    crawlIntervalDays,
    count: result.count,
  });
}
