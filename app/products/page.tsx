import Link from "next/link";
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

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: { histories: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });

  return (
    <section className="form">
      <div>
        <h1>商品一覧</h1>
        <p className="muted">登録した駿河屋PCゲーム商品の直近価格を確認できます。</p>
      </div>

      {products.length === 0 ? (
        <div className="card">
          <p>まだ商品が登録されていません。</p>
          <Link className="button" href="/add">
            最初の商品を追加する
          </Link>
        </div>
      ) : (
        <div className="grid">
          {products.map((product) => (
            <Link className="card product-card" href={`/products/${product.id}`} key={product.id}>
              <div className="product-image">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={product.title} src={product.imageUrl} />
                ) : (
                  <span className="muted">No Image</span>
                )}
              </div>
              <div className="product-title">{product.title}</div>
              <div className="price-row">
                <span className="badge">販売: {formatPrice(product.latestSalePrice)}</span>
                <span className="badge">買取: {formatPrice(product.latestBuyPrice)}</span>
              </div>
              <div className="meta-row muted">
                <span>{formatStockStatus(product.stockStatus)}</span>
                <span>履歴: {product.histories.length > 0 ? "あり" : "なし"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
