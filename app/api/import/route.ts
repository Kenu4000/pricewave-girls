import { NextResponse } from "next/server";
import { replaceAlternateConditionItems } from "@/lib/alternate-condition-items";
import { replaceEmbeddedOtherShopItems } from "@/lib/other-shop-items";
import { syncOtherShopSnapshotFromProductHtml } from "@/lib/other-shop-html-snapshot";
import {
  applySelectedCrawlSourceOffer,
  crawlSourceUrlFromDetailsJson,
  hasSurugayaCrawlSourceSelector,
  resolveProductCrawlSourceUrl,
  withProductCrawlSource,
} from "@/lib/product-crawl-source";
import { preserveIndividualDetailPeople } from "@/lib/product-detail-people";
import { productImportQueue } from "@/lib/product-import-queue";
import { stageProductSnapshot } from "@/lib/product-import-sessions";
import { prisma } from "@/lib/prisma";
import {
  InvalidSurugayaUrlError,
  normalizeSurugayaUrl,
  parseProductHtml,
} from "@/lib/surugaya";
import { withProductStateStorageMarkers } from "@/lib/time-sale";

export const runtime = "nodejs";

// 商品HTMLには /product/other/ の一覧HTMLを1回だけ埋め込む。
// 解析後は構造化スナップショットとJunkHistoryへ保存する。
const MAX_HTML_SIZE = 16 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: unknown;
      sourceUrl?: unknown;
      html?: unknown;
      sessionId?: unknown;
    };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : url;
    const html = typeof body.html === "string" ? body.html : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;

    if (!url || !html) {
      return NextResponse.json(
        { error: "商品ページのURLと表示内容が必要です" },
        { status: 400 },
      );
    }

    if (html.length > MAX_HTML_SIZE) {
      return NextResponse.json(
        { error: "商品ページと他ショップ一覧のデータが大きすぎます" },
        { status: 413 },
      );
    }

    // 商品の同一性はクエリなしURLで保持し、店舗個体URLは別の内部情報として保持する。
    const normalizedUrl = normalizeSurugayaUrl(sourceUrl || url);
    const existing = await prisma.product.findUnique({
      where: { surugayaUrl: normalizedUrl },
      select: { detailsJson: true },
    });
    const existingSourceUrl = crawlSourceUrlFromDetailsJson(existing?.detailsJson);
    const requestedSourceUrl = hasSurugayaCrawlSourceSelector(sourceUrl)
      ? sourceUrl
      : existingSourceUrl;
    const resolvedSourceUrl = requestedSourceUrl
      ? resolveProductCrawlSourceUrl(requestedSourceUrl, html)
      : null;

    if (requestedSourceUrl) {
      const requested = new URL(requestedSourceUrl);
      const resolved = resolvedSourceUrl ? new URL(resolvedSourceUrl) : null;
      if (
        requested.searchParams.get("tenpo_cd") &&
        !requested.searchParams.get("branch_number") &&
        !resolved?.searchParams.get("branch_number")
      ) {
        return NextResponse.json(
          {
            error:
              "店舗商品を特定できませんでした。取扱店舗一覧を読み込んでから、もう一度記録してください。",
          },
          { status: 422 },
        );
      }
    }

    // 100件バッチでDBへ保存される時刻ではなく、各商品HTMLが届いた時刻を
    // 価格取得時刻として保持する。これにより更新順が実際の取得順になる。
    const checkedAt = new Date();

    // /product/other/ は一度だけ取得し、表示端末に依存しない構造化データへ変換して保存する。
    // スナップショット保存失敗で価格取込自体を止めない。
    try {
      await syncOtherShopSnapshotFromProductHtml({
        surugayaUrl: normalizedUrl,
        productHtml: html,
        checkedAt,
      });
    } catch (snapshotError) {
      console.error("他店舗一覧スナップショットの保存に失敗しました", snapshotError);
    }

    const parsed = parseProductHtml(html);
    const withSafeConditions = replaceAlternateConditionItems(html, parsed);
    const withSafeOtherShops = replaceEmbeddedOtherShopItems(html, withSafeConditions);
    const withPeople = preserveIndividualDetailPeople(html, withSafeOtherShops);
    const withState = withProductStateStorageMarkers(html, withPeople);
    const withSelectedOffer = applySelectedCrawlSourceOffer(withState, resolvedSourceUrl, html);
    const fetched = withProductCrawlSource(withSelectedOffer, resolvedSourceUrl);

    if (sessionId) {
      const stagedCount = await stageProductSnapshot(sessionId, {
        surugayaUrl: normalizedUrl,
        fetched,
        checkedAt,
      });
      return NextResponse.json({ staged: true, stagedCount }, { status: 202 });
    }

    const product = await productImportQueue.enqueue({
      surugayaUrl: normalizedUrl,
      fetched,
      checkedAt,
    });

    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "商品の取込に失敗しました";
    const status = caught instanceof InvalidSurugayaUrlError ? 400 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
