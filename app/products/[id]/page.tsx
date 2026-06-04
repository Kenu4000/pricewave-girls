import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceChart } from "@/components/PriceChart";
import { RefreshButton } from "@/components/RefreshButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatPrice(price: number | null) {
  return price === null ? "未取得" : `${price.toLocaleString("ja-JP")}円`;
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
        </article>
      </div>

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
