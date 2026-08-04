import { NextResponse } from "next/server";
import { upsertProductSnapshot } from "@/lib/product-snapshots";
import {
  InvalidSurugayaUrlError,
  normalizeSurugayaUrl,
  parseProductHtml,
} from "@/lib/surugaya";

export const runtime = "nodejs";

const MAX_HTML_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown; html?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const html = typeof body.html === "string" ? body.html : "";

    if (!url || !html) {
      return NextResponse.json(
        { error: "商品ページのURLと表示内容が必要です" },
        { status: 400 },
      );
    }

    if (html.length > MAX_HTML_SIZE) {
      return NextResponse.json(
        { error: "商品ページのデータが大きすぎます" },
        { status: 413 },
      );
    }

    const normalizedUrl = normalizeSurugayaUrl(url);
    const fetched = parseProductHtml(html);
    const product = await upsertProductSnapshot(normalizedUrl, fetched);

    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "商品の取込に失敗しました";
    const status = caught instanceof InvalidSurugayaUrlError ? 400 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
