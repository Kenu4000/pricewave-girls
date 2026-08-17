import Link from "next/link";
import { notFound } from "next/navigation";
import { JunkHistorySections } from "@/components/JunkHistorySections";
import { PriceChart } from "@/components/PriceChart";
import { ProductCrawlIntervalControl } from "@/components/ProductCrawlIntervalControl";
import { readOtherShopSnapshotData } from "@/lib/other-shop-html-snapshot";
import {
  extractOperatingSystems,
  normalizeFilterChoiceValue,
  splitDetailPeople,
} from "@/lib/product-filter-options";
import { selectDisplayedPriceHistories } from "@/lib/price-history-display";
import { prisma } from "@/lib/prisma";
import { isInternalProductDetailLabel } from "@/lib/time-sale";

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

function formatCondition(condition: string | null | undefined, rank: string | null | undefined) {
  if (rank === "B" || condition) {
    return condition ? `ランクB（${condition}）` : "ランクB";
  }
  return "通常";
}

function parseProductDetails(rawDetails: string | null | undefined): Array<[string, string]> {
  if (!rawDetails) return [];
  try {
    const parsed = JSON.parse(rawDetails) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        !isInternalProductDetailLabel(entry[0]) &&
        typeof entry[1] === "string" &&
        entry[1].length > 0,
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
    return <Link href={productListUrl({ brand: normalizeFilterChoiceValue(value) })}>{value}</Link>;
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

  if (!Number.isInteger(productId)) notFound();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      histories: { orderBy: { checkedAt: "asc" } },
      junkHistories: { orderBy: [{ checkedAt: "desc" }, { id: "desc" }] },
    },
  });

  if (!product) notFound();

  const relatedProducts = await prisma.product.findMany({
    where: { title: product.title, id: { not: product.id } },
    select: {
      id: true,
      condition: true,
      conditionRank: true,
      histories: { orderBy: { checkedAt: "asc" } },
    },
  });

  const currentHistories = product.histories.map((history) => ({
    id: history.id,
    productId: product.id,
    checkedAt: history.checkedAt.toISOString(),
    salePrice: history.salePrice,
    regularSalePrice: history.regularSalePrice,
    buyPrice: history.buyPrice,
    stockStatus: history.stockStatus,
    condition: history.condition ?? product.condition,
    conditionRank: history.conditionRank ?? product.conditionRank,
    isTimeSale: history.isTimeSale,
  }));
  const relatedHistories = relatedProducts.flatMap((relatedProduct) =>
    relatedProduct.histories.map((history) => ({
      id: history.id,
      productId: relatedProduct.id,
      checkedAt: history.checkedAt.toISOString(),
      salePrice: history.salePrice,
      regularSalePrice: history.regularSalePrice,
      buyPrice: history.buyPrice,
      stockStatus: history.stockStatus,
      condition: history.condition ?? relatedProduct.condition,
      conditionRank: history.conditionRank ?? relatedProduct.conditionRank,
      isTimeSale: history.isTimeSale,
    })),
  );
  const histories = [...currentHistories, ...relatedHistories].sort(
    (left, right) =>
      new Date(left.checkedAt).getTime() - new Date(right.checkedAt).getTime() ||
      left.productId - right.productId ||
      left.id - right.id,
  );
  const displayedHistories = selectDisplayedPriceHistories([...histories].reverse());
  const junkHistoryItems = product.junkHistories.map((history) => ({
    id: history.id,
    sourceType: history.sourceType,
    storeName: history.storeName,
    condition: history.condition,
    price: history.price,
    checkedAt: history.checkedAt.toISOString(),
  }));
  const latestSnapshotAt = currentHistories.at(-1)?.checkedAt ?? null;
  const productDetails = parseProductDetails(product.detailsJson);
  const otherShopSnapshot = await readOtherShopSnapshotData(product.surugayaUrl);

  return (
    <section className="product-detail-page">
      <div className="detail-toolbar">
        <Link className="detail-back-link" href="/products">← 商品一覧へ</Link>
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
            <span className="badge">状態: {formatCondition(product.condition, product.conditionRank)}</span>
            {product.isTimeSale ? <span className="badge">タイムセール中</span> : null}
            {product.isTimeSale && product.latestRegularSalePrice !== null ? (
              <span className="badge">通常価格: {formatPrice(product.latestRegularSalePrice)}</span>
            ) : null}
          </div>
          <ProductCrawlIntervalControl
            initialValue={product.crawlIntervalDays as 1 | 3 | 7 | 14 | null}
            productId={product.id}
          />
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
                <dd><DetailValueLinks label={label} value={value} /></dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">
            詳細情報は未取得です。Edgeでこの商品を開き、拡張機能からもう一度記録すると補完されます。
          </p>
        )}
      </section>

      <JunkHistorySections
        items={junkHistoryItems}
        latestSnapshotAt={latestSnapshotAt}
        otherShopSnapshot={otherShopSnapshot}
        surugayaUrl={product.surugayaUrl}
      />

      <section className="card history-panel">
        <div className="history-summary">
          <h2>価格履歴</h2>
          <span className="muted">
            {displayedHistories.length < histories.length
              ? `${displayedHistories.length.toLocaleString("ja-JP")}件表示 / ${histories.length.toLocaleString("ja-JP")}件保存（直近10件＋過去の価格変化）`
              : `${histories.length.toLocaleString("ja-JP")}件`}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>確認日時</th><th>販売価格</th><th>通常価格</th><th>価格状態</th>
                <th>商品状態</th><th>買取価格</th><th>在庫</th>
              </tr>
            </thead>
            <tbody>
              {displayedHistories.map((history) => (
                <tr key={`${history.productId}:${history.id}`}>
                  <td>{new Date(history.checkedAt).toLocaleString("ja-JP")}</td>
                  <td>{formatPrice(history.salePrice)}</td>
                  <td>{formatPrice(history.regularSalePrice)}</td>
                  <td>{history.isTimeSale ? "タイムセール" : "通常"}</td>
                  <td>{formatCondition(history.condition, history.conditionRank)}</td>
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
