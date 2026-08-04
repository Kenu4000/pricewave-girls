import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceChart } from "@/components/PriceChart";
import { RefreshButton } from "@/components/RefreshButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatPrice(price: number | null | undefined) {
  return price == null ? "未取得" : `${price.toLocaleString("ja-JP")}円`;
}

function formatStockStatus(status: string | null) {
  switch (status) {
    case "in_stock":
      return "在庫あり";
    case "out_of_stock":
      return "在庫なし";
    default:
      return "在庫不明";
  }
}

function formatReleaseDate(date: string | null | undefined) {
  return date ? date.replace(/-/g, "/") : "未取得";
}

function parseProductDetails(rawDetails: string | null | undefined): Array<[string, string]> {
  if (!rawDetails) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawDetails) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    );
  } catch {
    return [];
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isInteger(productId)) {
    notFound();
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { histories: { orderBy: { checkedAt: "asc" } } },
  });

  if (!product) {
    notFound();
  }

  const histories = product.histories.map((history) => ({
    checkedAt: history.checkedAt.toISOString(),
    salePrice: history.salePrice,
    buyPrice: history.buyPrice,
    stockStatus: history.stockStatus,
  }));
  const productDetails = parseProductDetails(product.detailsJson);

  return (
    <section className="form">
      <Link className="button secondary" href="/products">
        ← 商品一覧へ
      </Link>
      <div className="detail-layout">
        <aside className="card product-card">
          <div className="product-image">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={product.title} src={product.imageUrl} />
            ) : (
              <span className="muted">No Image</span>
            )}
          </div>
          <a className="button secondary" href={product.surugayaUrl} rel="noreferrer" target="_blank">
            駿河屋ページを開く
          </a>
          <RefreshButton productId={product.id} />
        </aside>

        <article className="card form">
          <div>
            <h1>{product.title}</h1>
            <p className="muted">最終更新: {product.updatedAt.toLocaleString("ja-JP")}</p>
          </div>
          <div className="price-row">
            <span className="badge">販売価格: {formatPrice(product.latestSalePrice)}</span>
            <span className="badge">買取価格: {formatPrice(product.latestBuyPrice)}</span>
            <span className="badge">{formatStockStatus(product.stockStatus)}</span>
          </div>
          <dl className="detail-facts">
            <div>
              <dt>メーカー</dt><dd>{product.manufacturer ?? "未取得"}</dd>
            </div>
            <div>
              <dt>発売日</dt><dd>{formatReleaseDate(product.releaseDate)}</dd>
            </div>
            <div>
              <dt>定価</dt><dd>{formatPrice(product.listPrice)}</dd>
            </div>
            <div>
              <dt>型番</dt><dd>{product.modelNumber ?? "未取得"}</dd>
            </div>
            <div>
              <dt>管理番号</dt><dd>{product.managementNumber ?? "未取得"}</dd>
            </div>
          </dl>
        </article>
      </div>

      <section className="card">
        <h2>駿河屋の商品詳細情報</h2>
        {productDetails.length > 0 ? (
          <div className="table-wrap">
            <table>
              <tbody>
                {productDetails.map(([label, value]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            詳細情報は未取得です。Edgeでこの商品を開き、拡張機能からもう一度記録すると補完されます。
          </p>
        )}
      </section>

      <section className="card">
        <h2>価格推移</h2>
        <PriceChart histories={histories} />
      </section>

      <section className="card">
        <h2>価格履歴</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>確認日時</th>
                <th>販売価格</th>
                <th>買取価格</th>
                <th>在庫</th>
              </tr>
            </thead>
            <tbody>
              {[...histories].reverse().map((history) => (
                <tr key={history.checkedAt}>
                  <td>{new Date(history.checkedAt).toLocaleString("ja-JP")}</td>
                  <td>{formatPrice(history.salePrice)}</td>
                  <td>{formatPrice(history.buyPrice)}</td>
                  <td>{formatStockStatus(history.stockStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
