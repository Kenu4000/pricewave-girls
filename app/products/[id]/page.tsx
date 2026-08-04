import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceChart } from "@/components/PriceChart";
import {
  extractOperatingSystems,
  normalizeFilterChoiceValue,
  splitDetailPeople,
} from "@/lib/product-filter-options";
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

function formatJunkSource(sourceType: string) {
  return sourceType === "other_shop" ? "他ショップ" : "状態違い";
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

function productListUrl(params: Record<string, string>) {
  return `/products?${new URLSearchParams(params).toString()}`;
}

function DetailValueLinks({ label, value }: { label: string; value: string }) {
  const labelKey = normalizeFilterChoiceValue(label);

  if (["メーカー", "ブランド"].includes(labelKey)) {
    return (
      <Link href={productListUrl({ brand: normalizeFilterChoiceValue(value) })}>{value}</Link>
    );
  }

  const peopleFilter = ["原画", "原画家"].includes(labelKey)
    ? "illustrator"
    : ["シナリオ", "脚本"].includes(labelKey)
      ? "scenario"
      : ["声優", "キャスト"].includes(labelKey)
        ? "voiceActor"
        : null;
  if (peopleFilter) {
    return (
      <span className="detail-value-links">
        {splitDetailPeople(value).map((person) => (
          <Link
            href={productListUrl({ [peopleFilter]: normalizeFilterChoiceValue(person) })}
            key={person}
          >
            {person}
          </Link>
        ))}
      </span>
    );
  }

  if (["対応os", "動作os", "os", "対応機種", "カテゴリ"].includes(labelKey)) {
    const operatingSystems = extractOperatingSystems(value);
    if (operatingSystems.length > 0) {
      return (
        <span className="detail-value-links">
          {operatingSystems.map((operatingSystem) => (
            <Link href={productListUrl({ os: operatingSystem })} key={operatingSystem}>
              {operatingSystem}
            </Link>
          ))}
        </span>
      );
    }
  }

  if (labelKey === "発売日") {
    const year = value.match(/\d{4}/u)?.[0];
    if (year) return <Link href={productListUrl({ releaseYear: year })}>{value}</Link>;
  }

  return <Link href={productListUrl({ detailLabel: label, detailValue: value })}>{value}</Link>;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);

  if (!Number.isInteger(productId)) {
    notFound();
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      histories: { orderBy: { checkedAt: "asc" } },
      junkHistories: { orderBy: [{ checkedAt: "desc" }, { id: "desc" }] },
    },
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
    <section className="product-detail-page">
      <div className="detail-toolbar">
        <Link className="detail-back-link" href="/products">
          ← 商品一覧へ
        </Link>
      </div>

      <section className="card detail-overview">
        <aside className="detail-media">
          <div className="detail-product-image">
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
        </aside>

        <article className="detail-summary">
          <header>
            <h1>{product.title}</h1>
            <p className="muted">最終更新: {product.updatedAt.toLocaleString("ja-JP")}</p>
          </header>
          <div className="price-row">
            <span className="badge">販売価格: {formatPrice(product.latestSalePrice)}</span>
            <span className="badge">買取価格: {formatPrice(product.latestBuyPrice)}</span>
            <span className="badge">{formatStockStatus(product.stockStatus)}</span>
          </div>
        </article>

        <section className="detail-chart-panel">
          <h2>価格推移</h2>
          <PriceChart histories={histories} />
        </section>
      </section>

      <section className="card detail-section">
        <h2>駿河屋の商品詳細情報</h2>
        {productDetails.length > 0 ? (
          <dl className="surugaya-detail-grid">
            {productDetails.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <DetailValueLinks label={label} value={value} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">
            詳細情報は未取得です。Edgeでこの商品を開き、拡張機能からもう一度記録すると補完されます。
          </p>
        )}
      </section>

      <section className="card junk-history-panel">
        <div className="history-summary">
          <h2>ジャンク履歴</h2>
          <span className="muted">{product.junkHistories.length.toLocaleString("ja-JP")}件</span>
        </div>
        {product.junkHistories.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>確認日時</th>
                  <th>種別</th>
                  <th>店舗名</th>
                  <th>状態</th>
                  <th>価格</th>
                </tr>
              </thead>
              <tbody>
                {product.junkHistories.map((history) => (
                  <tr key={history.id}>
                    <td>{history.checkedAt.toLocaleString("ja-JP")}</td>
                    <td>{formatJunkSource(history.sourceType)}</td>
                    <td>{history.storeName ?? "—"}</td>
                    <td>{history.condition}</td>
                    <td>{formatPrice(history.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            「その他の状態を選ぶ」または「他のショップ」の商品はまだ記録されていません。
          </p>
        )}
      </section>

      <section className="card history-panel">
        <div className="history-summary">
          <h2>価格履歴</h2>
          <span className="muted">{histories.length.toLocaleString("ja-JP")}件</span>
        </div>
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
