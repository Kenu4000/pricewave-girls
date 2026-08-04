import { NextResponse } from "next/server";
import { upsertProductSnapshot } from "@/lib/product-snapshots";
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
    const product = await upsertProductSnapshot(normalizedUrl, fetched);

    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "商品の追加に失敗しました";
    const status = caught instanceof InvalidSurugayaUrlError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
