import { readOtherShopSnapshotHtml } from "@/lib/other-shop-html-snapshot";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productCode: string }> },
) {
  const { productCode } = await params;
  if (!/^[0-9A-Za-z]+$/u.test(productCode)) {
    return new Response("Not Found", { status: 404 });
  }

  const html = await readOtherShopSnapshotHtml(productCode);
  if (!html) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
