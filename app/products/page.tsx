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
const STOCK_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "in_stock", label: "在庫あり" },
  { value: "out_of_stock", label: "在庫なし" },
  { value: "unknown", label: "在庫不明" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];
type PageSize = (typeof PAGE_SIZES)[number];
type StockFilter = (typeof STOCK_OPTIONS)[number]["value"];

type ProductFilters = {
  name: string;
  manufacturer: string;
  category: string;
  details: string;
  releaseFrom: string;
  releaseTo: string;
  saleMin: string;
  saleMax: string;
  buyMin: string;
  buyMax: string;
  stock: StockFilter;
};

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

function parseText(value: string | undefined): string {
  return value?.trim().slice(0, 200) ?? "";
}

function parseDate(value: string | undefined): string {
  const parsed = parseText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : "";
}

function parsePrice(value: string | undefined): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "";

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? String(parsed) : "";
}

function parseStock(value: string | undefined): StockFilter {
  return STOCK_OPTIONS.some((option) => option.value === value)
    ? (value as StockFilter)
    : "";
}

function parseFilters(query: Record<string, string | string[] | undefined>): ProductFilters {
  return {
    name: parseText(firstValue(query.name)),
    manufacturer: parseText(firstValue(query.manufacturer)),
    category: parseText(firstValue(query.category)),
    details: parseText(firstValue(query.details)),
    releaseFrom: parseDate(firstValue(query.releaseFrom)),
    releaseTo: parseDate(firstValue(query.releaseTo)),
    saleMin: parsePrice(firstValue(query.saleMin)),
    saleMax: parsePrice(firstValue(query.saleMax)),
    buyMin: parsePrice(firstValue(query.buyMin)),
    buyMax: parsePrice(firstValue(query.buyMax)),
    stock: parseStock(firstValue(query.stock)),
  };
}

function hasActiveFilters(filters: ProductFilters): boolean {
  return Object.values(filters).some(Boolean);
}

function buildProductWhere(filters: ProductFilters): Prisma.ProductWhereInput {
  const conditions: Prisma.ProductWhereInput[] = [];

  if (filters.name) {
    conditions.push({ title: { contains: filters.name } });
  }
  if (filters.manufacturer) {
    conditions.push({ manufacturer: filters.manufacturer });
  }
  if (filters.category) {
    conditions.push({ category: filters.category });
  }
  if (filters.details) {
    conditions.push({
      OR: [
        { manufacturer: { contains: filters.details } },
        { category: { contains: filters.details } },
        { modelNumber: { contains: filters.details } },
        { managementNumber: { contains: filters.details } },
        { detailsJson: { contains: filters.details } },
      ],
    });
  }
  if (filters.releaseFrom || filters.releaseTo) {
    conditions.push({
      releaseDate: {
        ...(filters.releaseFrom ? { gte: filters.releaseFrom } : {}),
        ...(filters.releaseTo ? { lte: filters.releaseTo } : {}),
      },
    });
  }
  if (filters.saleMin || filters.saleMax) {
    conditions.push({
      latestSalePrice: {
        ...(filters.saleMin ? { gte: Number(filters.saleMin) } : {}),
        ...(filters.saleMax ? { lte: Number(filters.saleMax) } : {}),
      },
    });
  }
  if (filters.buyMin || filters.buyMax) {
    conditions.push({
      latestBuyPrice: {
        ...(filters.buyMin ? { gte: Number(filters.buyMin) } : {}),
        ...(filters.buyMax ? { lte: Number(filters.buyMax) } : {}),
      },
    });
  }
  if (filters.stock === "unknown") {
    conditions.push({ OR: [{ stockStatus: "unknown" }, { stockStatus: null }] });
  } else if (filters.stock) {
    conditions.push({ stockStatus: filters.stock });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

function addFilterParams(params: URLSearchParams, filters: ProductFilters) {
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
}

function listUrl(
  page: number,
  sort: SortKey,
  perPage: PageSize,
  filters: ProductFilters,
): string {
  const params = new URLSearchParams({ sort, perPage: String(perPage) });
  addFilterParams(params, filters);
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
  const filters = parseFilters(query);
  const where = buildProductWhere(filters);
  const filtersActive = hasActiveFilters(filters);
  const [totalProducts, allProducts, manufacturerRows, categoryRows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count(),
    prisma.product.findMany({
      where: { manufacturer: { not: null } },
      select: { manufacturer: true },
      distinct: ["manufacturer"],
      orderBy: { manufacturer: "asc" },
    }),
    prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const products = await prisma.product.findMany({
    where,
    orderBy: SORT_ORDERS[sort],
    skip: (currentPage - 1) * perPage,
    take: perPage,
    include: { histories: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });
  const firstShown = totalProducts === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const lastShown = Math.min(currentPage * perPage, totalProducts);
  const manufacturers = manufacturerRows.flatMap((row) =>
    row.manufacturer ? [row.manufacturer] : [],
  );
  const categories = categoryRows.flatMap((row) => (row.category ? [row.category] : []));

  return (
    <section className="product-list-page">
      <div className="list-heading">
        <div>
          <h1>商品一覧</h1>
          <p className="muted">
            {filtersActive ? (
              <>
                全{allProducts.toLocaleString("ja-JP")}件中、条件に一致する
                {totalProducts.toLocaleString("ja-JP")}件
              </>
            ) : (
              <>全{totalProducts.toLocaleString("ja-JP")}件</>
            )}
            {totalProducts > 0 ? (
              <>
                （{firstShown.toLocaleString("ja-JP")}〜{lastShown.toLocaleString("ja-JP")}件を表示）
              </>
            ) : null}
          </p>
        </div>
      </div>

      <form action="/products" className="card filter-panel">
        <div className="filter-grid">
          <label className="filter-field filter-field-wide">
            <span>商品名</span>
            <input
              className="input"
              defaultValue={filters.name}
              name="name"
              placeholder="商品名の一部を入力"
              type="search"
            />
          </label>
          <label className="filter-field">
            <span>メーカー</span>
            <select className="select" defaultValue={filters.manufacturer} name="manufacturer">
              <option value="">すべて</option>
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>カテゴリ</span>
            <select className="select" defaultValue={filters.category} name="category">
              <option value="">すべて</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field filter-field-wide">
            <span>型番・管理番号・その他詳細</span>
            <input
              className="input"
              defaultValue={filters.details}
              name="details"
              placeholder="例: 原画、シナリオ、型番"
              type="search"
            />
          </label>
          <fieldset className="filter-field filter-field-wide">
            <legend>発売日</legend>
            <div className="range-fields">
              <input
                aria-label="発売日の開始日"
                className="input"
                defaultValue={filters.releaseFrom}
                name="releaseFrom"
                type="date"
              />
              <span>〜</span>
              <input
                aria-label="発売日の終了日"
                className="input"
                defaultValue={filters.releaseTo}
                name="releaseTo"
                type="date"
              />
            </div>
          </fieldset>
          <fieldset className="filter-field filter-field-wide">
            <legend>販売価格</legend>
            <div className="range-fields">
              <input
                aria-label="販売価格の下限"
                className="input"
                defaultValue={filters.saleMin}
                min="0"
                name="saleMin"
                placeholder="下限"
                type="number"
              />
              <span>〜</span>
              <input
                aria-label="販売価格の上限"
                className="input"
                defaultValue={filters.saleMax}
                min="0"
                name="saleMax"
                placeholder="上限"
                type="number"
              />
            </div>
          </fieldset>
          <fieldset className="filter-field filter-field-wide">
            <legend>買取価格</legend>
            <div className="range-fields">
              <input
                aria-label="買取価格の下限"
                className="input"
                defaultValue={filters.buyMin}
                min="0"
                name="buyMin"
                placeholder="下限"
                type="number"
              />
              <span>〜</span>
              <input
                aria-label="買取価格の上限"
                className="input"
                defaultValue={filters.buyMax}
                min="0"
                name="buyMax"
                placeholder="上限"
                type="number"
              />
            </div>
          </fieldset>
          <label className="filter-field">
            <span>在庫状態</span>
            <select className="select" defaultValue={filters.stock} name="stock">
              {STOCK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>並び順</span>
            <select className="select" defaultValue={sort} name="sort">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>表示件数</span>
            <select className="select" defaultValue={perPage} name="perPage">
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}件
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-actions">
          <Link className="button secondary" href="/products">
            条件をクリア
          </Link>
          <button type="submit">この条件で絞り込む</button>
        </div>
      </form>

      {products.length === 0 ? (
        <div className="card">
          <p>{filtersActive ? "条件に一致する商品がありません。" : "まだ商品が登録されていません。"}</p>
          {filtersActive ? (
            <Link className="button secondary" href="/products">
              条件をクリア
            </Link>
          ) : null}
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
                href={listUrl(Math.max(1, currentPage - 1), sort, perPage, filters)}
              >
                ← 前へ
              </Link>
              {visiblePageNumbers(currentPage, totalPages).map((page) => (
                <Link
                  aria-current={page === currentPage ? "page" : undefined}
                  className={`page-link ${page === currentPage ? "current" : ""}`}
                  href={listUrl(page, sort, perPage, filters)}
                  key={page}
                >
                  {page}
                </Link>
              ))}
              <Link
                aria-disabled={currentPage === totalPages}
                className={`page-link ${currentPage === totalPages ? "disabled" : ""}`}
                href={listUrl(Math.min(totalPages, currentPage + 1), sort, perPage, filters)}
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
