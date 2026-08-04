import { NextResponse } from "next/server";
import { commitProductImportSession } from "@/lib/product-import-sessions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const ids = await commitProductImportSession(sessionId);
    return NextResponse.json({ count: ids.length, ids });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "一括保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
