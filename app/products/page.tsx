import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SORT_OPTIONS = [
  { value: "updated-desc", label: "更新が新しい順" },
  { value: "updated-asc", label: "更新が古い順" },
  { value: "sale-asc", label: "販売価格が安い順" },
  { value: "sale-desc", label: "販売価格が高い順" },
  { value: "buy-desc", label: "買取価格が高い順" },
  { value: "buy-asc", label: "買取価格が安い順" },
  { value: "release-desc", label: "発売日が新しい順" },
  { value: "release-asc", label: "発売日が古い順" },
  { value: "list-asc", label: "定価が安い順" },
  { value: "list-desc", label: "定価が高い順" },
  { value: "manufacturer-asc", label: "メーカー順" },
  { value: "title-asc", label: "商品名順" },
] as const;

const PAGE_SIZES = [24, 48, 96] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];
type PageSize = (typeof PAGE_SIZES)[number];

const SORT_ORDERS = {
  "updated-desc": [{ updatedAt: "desc" }, { id: "desc" }],
  "updated-asc": [{ updatedAt: "asc" }, { id: "asc" }],
  "sale-asc": [
    { latestSalePrice: { sort: "asc", nulls: "last" } },
    { title: "asc" },
  ],
  "sale-desc": [
    { latestSalePrice: { sort: "desc", nulls: "last" } },
    { title: "asc" },
  ],
  "buy-desc": [
    { latestBuyPrice: { sort: "desc", nulls: "last" } },
    { title: "asc" },
  ],
  "buy-asc": [
    { latestBuyPrice: { sort: "asc", nulls: "last" } },
    { title: "asc" },
  ],
  "release-desc": [
    { releaseDate: { sort: "desc", nulls: "last" } },
    { title: "asc" },
  ],
  "release-asc": [
    { releaseDate: { sort: "asc", nulls: "last" } },
    { title: "asc" },
  ],
  "list-asc": [{ listPrice: { sort: "asc", nulls: "last" } }, { title: "asc" }],
  "list-desc": [{ listPrice: { sort: "desc", nulls: "last" } }, { title: "asc" }],
  "manufacturer-asc": [
    { manufacturer: { sort: "asc", nulls: "last" } },
    { title: "asc" },
  ],
  "title-asc": [{ title: "asc" }, { id: "asc" }],
} satisfies Record<SortKey, Prisma.ProductOrderByWithRelationInput[]>;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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

function formatReleaseDate(date: string | null) {
  return date ? date.replace(/-/g, "/") : null;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSort(value: string | undefined): SortKey {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as SortKey)
    : "updated-desc";
}

function parsePageSize(value: string | undefined): PageSize {
  const parsed = Number(value);
  return PAGE_SIZES.includes(parsed as PageSize) ? (parsed as PageSize) : 24;
}

function listUrl(page: number, sort: SortKey, perPage: PageSize): string {
  const params = new URLSearchParams({ sort, perPage: String(perPage) });
  if (page > 1) {
    params.set("page", String(page));
  }
  return `/products?${params.toString()}`;
}

function visiblePageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const sort = parseSort(firstValue(query.sort));
  const perPage = parsePageSize(firstValue(query.perPage));
  const requestedPage = parsePositiveInteger(firstValue(query.page), 1);
  const totalProducts = await prisma.product.count();
  const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const products = await prisma.product.findMany({
    orderBy: SORT_ORDERS[sort],
    skip: (currentPage - 1) * perPage,
    take: perPage,
    include: { histories: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });
  const firstShown = totalProducts === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const lastShown = Math.min(currentPage * perPage, totalProducts);

  return (
    <section className="product-list-page">
      <div className="list-heading">
        <div>
          <h1>商品一覧</h1>
          <p className="muted">
            全{totalProducts.toLocaleString("ja-JP")}件中 {firstShown.toLocaleString("ja-JP")}〜
            {lastShown.toLocaleString("ja-JP")}件を表示
          </p>
        </div>
        <form action="/products" className="list-controls">
          <label>
            <span>並び順</span>
            <select className="select" defaultValue={sort} name="sort">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>表示件数</span>
            <select className="select" defaultValue={perPage} name="perPage">
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}件
                </option>
              ))}
            </select>
          </label>
          <button type="submit">表示を変更</button>
        </form>
      </div>

      {products.length === 0 ? (
        <div className="card">
          <p>まだ商品が登録されていません。</p>
          <Link className="button" href="/add">
            最初の商品を追加する
          </Link>
        </div>
      ) : (
        <>
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
                <dl className="product-facts">
                  {product.manufacturer ? (
                    <div><dt>メーカー</dt><dd>{product.manufacturer}</dd></div>
                  ) : null}
                  {product.releaseDate ? (
                    <div><dt>発売日</dt><dd>{formatReleaseDate(product.releaseDate)}</dd></div>
                  ) : null}
                  {product.modelNumber ? (
                    <div><dt>型番</dt><dd>{product.modelNumber}</dd></div>
                  ) : null}
                </dl>
                <div className="meta-row muted">
                  <span>{formatStockStatus(product.stockStatus)}</span>
                  <span>履歴: {product.histories.length > 0 ? "あり" : "なし"}</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav aria-label="商品一覧のページ" className="pagination">
              <Link
                aria-disabled={currentPage === 1}
                className={`page-link ${currentPage === 1 ? "disabled" : ""}`}
                href={listUrl(Math.max(1, currentPage - 1), sort, perPage)}
              >
                ← 前へ
              </Link>
              {visiblePageNumbers(currentPage, totalPages).map((page) => (
                <Link
                  aria-current={page === currentPage ? "page" : undefined}
                  className={`page-link ${page === currentPage ? "current" : ""}`}
                  href={listUrl(page, sort, perPage)}
                  key={page}
                >
                  {page}
                </Link>
              ))}
              <Link
                aria-disabled={currentPage === totalPages}
                className={`page-link ${currentPage === totalPages ? "disabled" : ""}`}
                href={listUrl(Math.min(totalPages, currentPage + 1), sort, perPage)}
              >
                次へ →
              </Link>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
