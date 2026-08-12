import { NextResponse } from "next/server";
import { replaceAlternateConditionItems } from "@/lib/alternate-condition-items";
import { syncOtherShopSnapshotFromProductHtml } from "@/lib/other-shop-html-snapshot";
import { preserveIndividualDetailPeople } from "@/lib/product-detail-people";
import { productImportQueue } from "@/lib/product-import-queue";
import { stageProductSnapshot } from "@/lib/product-import-sessions";
import {
  InvalidSurugayaUrlError,
  normalizeSurugayaUrl,
  parseProductHtml,
} from "@/lib/surugaya";
import { withProductStateStorageMarkers } from "@/lib/time-sale";

export const runtime = "nodejs";

// The Edge extension embeds the marketplace listing in the product HTML before
// import, so pages with many shop offers can exceed the former 5 MiB limit.
const MAX_HTML_SIZE = 12 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: unknown;
      html?: unknown;
      sessionId?: unknown;
    };
    const url = typeof body.url === "string" ? body.url.trim() : "";
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

    // 100件バッチでDBへ保存される時刻ではなく、各商品HTMLが届いた時刻を
    // 価格取得時刻として保持する。これにより更新順が実際の取得順になる。
    const checkedAt = new Date();
    const normalizedUrl = normalizeSurugayaUrl(url);

    // 拡張機能が商品HTML内へ埋め込んだ /product/other/ の全文は、
    // DBの店舗履歴とは別に最新1枚だけローカルへ保存する。
    // スナップショット保存失敗で価格取込自体を止めない。
    try {
      await syncOtherShopSnapshotFromProductHtml({
        surugayaUrl: normalizedUrl,
        productHtml: html,
        checkedAt,
      });
    } catch (snapshotError) {
      console.error("他店舗一覧HTMLスナップショットの保存に失敗しました", snapshotError);
    }

    const parsed = parseProductHtml(html);
    const withSafeConditions = replaceAlternateConditionItems(html, parsed);
    const withPeople = preserveIndividualDetailPeople(html, withSafeConditions);
    const fetched = withProductStateStorageMarkers(html, withPeople);
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
