import {
  readOtherShopSnapshotHtml,
  type OtherShopSnapshotVariant,
} from "@/lib/other-shop-html-snapshot";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productCode: string }> },
) {
  const { productCode } = await params;
  if (!/^[0-9A-Za-z]+$/u.test(productCode)) {
    return new Response("Not Found", { status: 404 });
  }

  const variantParam = new URL(request.url).searchParams.get("variant");
  const variant: OtherShopSnapshotVariant = variantParam === "mobile" ? "mobile" : "desktop";
  const html = await readOtherShopSnapshotHtml(productCode, variant);
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
