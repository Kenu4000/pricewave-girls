import { readOtherShopSnapshotData } from "@/lib/other-shop-html-snapshot";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productCode: string }> },
) {
  const { productCode } = await params;
  if (!/^[0-9A-Za-z]+$/u.test(productCode)) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const snapshot = await readOtherShopSnapshotData(
    `https://www.suruga-ya.jp/product/detail/${productCode}`,
  );
  if (!snapshot) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  return Response.json(snapshot, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
