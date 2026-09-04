import { NextResponse } from "next/server";
import {
  crawlPriorityForProduct,
  isDailyCrawlProductTitle,
  productBrandCandidates,
} from "@/lib/crawl-brand-priority";
import {
  hasSurugayaCrawlSourceSelector,
  normalizeSurugayaCrawlSourceUrl,
  productCrawlUrl,
  withProductCrawlSource,
} from "@/lib/product-crawl-source";
import { prisma } from "@/lib/prisma";
import { releaseDayCrawlDecision } from "@/lib/release-day-crawl";
import { fetchSurugayaHtml } from "@/lib/surugaya-browser";
import {
  InvalidSurugayaUrlError,
  normalizeSurugayaUrl,
  parseProductHtml,
} from "@/lib/surugaya";
import { withProductStateStorageMarkers } from "@/lib/time-sale";
import { upsertProductSnapshotsWithTimeSale } from "@/lib/time-sale-persistence";

export const runtime = "nodejs";

const RELEASE_PROMOTION_CHUNK_SIZE = 400;

type ReleasePromotionGroup = {
  releaseDateKey: string;
  productIds: number[];
};

function releasePromotionGroups(
  entries: Array<{ releaseDateKey: string; productId: number }>,
): ReleasePromotionGroup[] {
  const grouped = new Map<string, number[]>();
  for (const entry of entries) {
    const ids = grouped.get(entry.releaseDateKey) ?? [];
    ids.push(entry.productId);
    grouped.set(entry.releaseDateKey, ids);
  }
  return [...grouped.entries()].map(([releaseDateKey, productIds]) => ({
    releaseDateKey,
    productIds,
  }));
}

async function markReleasePromotions(
  groups: ReleasePromotionGroup[],
  options: { setDaily: boolean },
) {
  for (const group of groups) {
    for (
      let start = 0;
      start < group.productIds.length;
      start += RELEASE_PROMOTION_CHUNK_SIZE
    ) {
      const ids = group.productIds.slice(start, start + RELEASE_PROMOTION_CHUNK_SIZE);
      await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: options.setDaily
          ? {
              crawlIntervalDays: 1,
              crawlIntervalReviewedAt: null,
              releaseCrawlPromotedForDate: group.releaseDateKey,
            }
          : { releaseCrawlPromotedForDate: group.releaseDateKey },
      });
    }
  }
}

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      surugayaUrl: true,
      manufacturer: true,
      releaseDate: true,
      detailsJson: true,
      crawlIntervalDays: true,
      createdAt: true,
      releaseCrawlPromotedForDate: true,
      histories: {
        orderBy: { checkedAt: "desc" },
        take: 1,
        select: { checkedAt: true },
      },
    },
  });

  const now = new Date();
  const promoteToDaily: Array<{ releaseDateKey: string; productId: number }> = [];
  const markHandledOnly: Array<{ releaseDateKey: string; productId: number }> = [];

  for (const product of products) {
    const decision = releaseDayCrawlDecision(product, now);
    if (!decision.shouldMarkHandled || !decision.releaseDateKey) continue;
    const target = decision.shouldSetDaily ? promoteToDaily : markHandledOnly;
    target.push({ releaseDateKey: decision.releaseDateKey, productId: product.id });
  }

  await markReleasePromotions(releasePromotionGroups(promoteToDaily), { setDaily: true });
  await markReleasePromotions(releasePromotionGroups(markHandledOnly), { setDaily: false });
  const promotedIds = new Set(promoteToDaily.map((entry) => entry.productId));

  return NextResponse.json({
    products: products.map((product) => {
      const brandCandidates = productBrandCandidates(product.manufacturer, product.detailsJson);
      return {
        id: product.id,
        title: product.title,
        url: productCrawlUrl(product.surugayaUrl, product.detailsJson),
        crawlIntervalDays: promotedIds.has(product.id) ? 1 : product.crawlIntervalDays,
        lastCheckedAt: product.histories[0]?.checkedAt.toISOString() ?? null,
        // 旧拡張機能との互換用。新しい自動巡回判定には使用しない。
        brand: brandCandidates[0] ?? null,
        brands: brandCandidates,
        dailyByTitle: isDailyCrawlProductTitle(product.title),
        crawlPriority: crawlPriorityForProduct(product.title, product.manufacturer, product.detailsJson),
      };
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "URLを入力してください" }, { status: 400 });

    const normalizedUrl = normalizeSurugayaUrl(url);
    const crawlSourceUrl = hasSurugayaCrawlSourceSelector(url)
      ? normalizeSurugayaCrawlSourceUrl(url)
      : null;
    const fetchUrl = crawlSourceUrl ?? normalizedUrl;
    const html = await fetchSurugayaHtml(fetchUrl);
    const withState = withProductStateStorageMarkers(html, parseProductHtml(html));
    const fetched = withProductCrawlSource(withState, crawlSourceUrl);
    const [product] = await upsertProductSnapshotsWithTimeSale([{ surugayaUrl: normalizedUrl, fetched }]);
    if (!product) throw new Error("商品の保存に失敗しました");

    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "商品の追加に失敗しました";
    const status = caught instanceof InvalidSurugayaUrlError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
