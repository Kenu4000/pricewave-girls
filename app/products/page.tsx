import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductListCount } from "@/components/ProductListCount";
import {
  buildProductFilterCatalog,
  detailFilterValue,
  findPriceBand,
  PRICE_BANDS,
  type ProductFilterCatalog,
  type RankedFilterOptions,
} from "@/lib/product-filter-options";
import { sortProductIdsByLatestHistory } from "@/lib/product-history-order";
import { sortProductsByPriceSpread } from "@/lib/product-price-spread";
import { conditionAnnotatedProductIds } from "@/lib/product-title-condition";
import { prisma } from "@/lib/prisma";
import type { ProductPreview } from "@/lib/product-preview";
import intervalStyles from "./CrawlIntervalFilter.module.css";

export const dynamic = "force-dynamic";

const SORT_OPTIONS = [
  { value: "updated-desc", label: "確認履歴が新しい順" },
  { value: "updated-asc", label: "確認履歴が古い順" },
  { value: "sale-asc", label: "販売価格が安い順" },
  { value: "sale-desc", label: "販売価格が高い順" },
  { value: "buy-desc", label: "買取価格が高い順" },
  { value: "buy-asc", label: "買取価格が安い順" },
  { value: "spread-desc", label: "販売・買取の差が大きい順" },
  { value: "spread-asc", label: "販売・買取の差が小さい順" },
  { value: "release-desc", label: "発売年度が新しい順" },
  { value: "release-asc", label: "発売年度が古い順" },
] as const;

const PAGE_SIZES = [24, 48, 96] as const;
const STOCK_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "in_stock", label: "在庫あり" },
  { value: "out_of_stock", label: "在庫なし" },
  { value: "unknown", label: "在庫不明" },
] as const;
const CRAWL_INTERVAL_OPTIONS = [
  { value: "", label: "すべて", tone: "all" },
  { value: "1", label: "1日", tone: "one" },
  { value: "3", label: "3日", tone: "three" },
  { value: "7", label: "7日", tone: "seven" },
  { value: "14", label: "14日", tone: "fourteen" },
  { value: "off", label: "無", tone: "off" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];
type HistorySortKey = Extract<SortKey, "updated-desc" | "updated-asc">;
type SpreadSortKey = Extract<SortKey, "spread-asc" | "spread-desc">;
type DatabaseSortKey = Exclude<SortKey, HistorySortKey | SpreadSortKey>;
type PageSize = (typeof PAGE_SIZES)[number];
type StockFilter = (typeof STOCK_OPTIONS)[number]["value"];
type CrawlIntervalFilter = (typeof CRAWL_INTERVAL_OPTIONS)[number]["value"];
type ConditionTitleFilter = "" | "exclude";

type ProductFilters = {
  name: string;
  brand: string;
  os: string;
  illustrator: string;
  scenario: string;
  voiceActor: string;
  releaseYear: string;
  saleBand: string;
  buyBand: string;
  stock: StockFilter;
  crawlInterval: CrawlIntervalFilter;
  conditionTitle: ConditionTitleFilter;
  detailLabel: string;
  detailValue: string;
};

const SORT_ORDERS = {
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
} satisfies Record<DatabaseSortKey, Prisma.ProductOrderByWithRelationInput[]>;

const PRODUCT_INCLUDE = {
  histories: { orderBy: { checkedAt: "desc" as const }, take: 1 },
} satisfies Prisma.ProductInclude;
type ListedProduct = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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

function parseText(value: string | undefined, maxLength = 200): string {
  return value?.trim().slice(0, maxLength) ?? "";
}

function parseReleaseYear(value: string | undefined): string {
  const parsed = parseText(value);
  return /^\d{4}$/.test(parsed) ? parsed : "";
}

function parsePriceBand(value: string | undefined): string {
  const parsed = parseText(value);
  return findPriceBand(parsed) ? parsed : "";
}

function parseStock(value: string | undefined): StockFilter {
  return STOCK_OPTIONS.some((option) => option.value === value)
    ? (value as StockFilter)
    : "";
}

function parseCrawlInterval(value: string | undefined): CrawlIntervalFilter {
  return CRAWL_INTERVAL_OPTIONS.some((option) => option.value === value)
    ? (value as CrawlIntervalFilter)
    : "";
}

function parseConditionTitle(value: string | undefined): ConditionTitleFilter {
  return value === "exclude" ? "exclude" : "";
}

function parseFilters(query: Record<string, string | string[] | undefined>): ProductFilters {
  return {
    name: parseText(firstValue(query.name)),
    brand: parseText(firstValue(query.brand)),
    os: parseText(firstValue(query.os)),
    illustrator: parseText(firstValue(query.illustrator)),
    scenario: parseText(firstValue(query.scenario)),
    voiceActor: parseText(firstValue(query.voiceActor)),
    releaseYear: parseReleaseYear(firstValue(query.releaseYear)),
    saleBand: parsePriceBand(firstValue(query.saleBand)),
    buyBand: parsePriceBand(firstValue(query.buyBand)),
    stock: parseStock(firstValue(query.stock)),
    crawlInterval: parseCrawlInterval(firstValue(query.crawlInterval)),
    conditionTitle: parseConditionTitle(firstValue(query.conditionTitle)),
    detailLabel: parseText(firstValue(query.detailLabel), 30),
    detailValue: parseText(firstValue(query.detailValue), 500),
  };
}

function hasActiveFilters(filters: ProductFilters): boolean {
  return Object.values(filters).some(Boolean);
}

function isHistorySort(sort: SortKey): sort is HistorySortKey {
  return sort === "updated-desc" || sort === "updated-asc";
}

function isSpreadSort(sort: SortKey): sort is SpreadSortKey {
  return sort === "spread-asc" || sort === "spread-desc";
}

function addIndexedFilter(
  conditions: Prisma.ProductWhereInput[],
  value: string,
  index: ProductFilterCatalog["brands"],
) {
  if (value) conditions.push({ id: { in: index.productIds.get(value) ?? [] } });
}

function buildProductWhere(
  filters: ProductFilters,
  catalog: ProductFilterCatalog,
  conditionTitleIds: number[],
): Prisma.ProductWhereInput {
  const conditions: Prisma.ProductWhereInput[] = [];

  if (filters.name) {
    conditions.push({ title: { contains: filters.name } });
  }
  addIndexedFilter(conditions, filters.brand, catalog.brands);
  addIndexedFilter(conditions, filters.os, catalog.operatingSystems);
  addIndexedFilter(conditions, filters.illustrator, catalog.illustrators);
  addIndexedFilter(conditions, filters.scenario, catalog.scenarios);
  addIndexedFilter(conditions, filters.voiceActor, catalog.voiceActors);
  if (filters.conditionTitle === "exclude" && conditionTitleIds.length > 0) {
    conditions.push({ id: { notIn: conditionTitleIds } });
  }
  if (filters.detailLabel && filters.detailValue) {
    conditions.push({
      id: {
        in:
          catalog.detailProductIds.get(
            detailFilterValue(filters.detailLabel, filters.detailValue),
          ) ?? [],
      },
    });
  }
  if (filters.releaseYear) {
    conditions.push({ releaseDate: { startsWith: `${filters.releaseYear}-` } });
  }

  const saleBand = findPriceBand(filters.saleBand);
  if (saleBand?.unknown) {
    conditions.push({ latestSalePrice: null });
  } else if (saleBand) {
    conditions.push({
      latestSalePrice: {
        ...(saleBand.min !== undefined ? { gte: saleBand.min } : {}),
        ...(saleBand.max !== undefined ? { lte: saleBand.max } : {}),
      },
    });
  }

  const buyBand = findPriceBand(filters.buyBand);
  if (buyBand?.unknown) {
    conditions.push({ latestBuyPrice: null });
  } else if (buyBand) {
    conditions.push({
      latestBuyPrice: {
        ...(buyBand.min !== undefined ? { gte: buyBand.min } : {}),
        ...(buyBand.max !== undefined ? { lte: buyBand.max } : {}),
      },
    });
  }
  if (filters.stock === "unknown") {
    conditions.push({ OR: [{ stockStatus: "unknown" }, { stockStatus: null }] });
  } else if (filters.stock) {
    conditions.push({ stockStatus: filters.stock });
  }
  if (filters.crawlInterval === "off") {
    conditions.push({ crawlIntervalDays: null });
  } else if (filters.crawlInterval) {
    conditions.push({ crawlIntervalDays: Number(filters.crawlInterval) });
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

function RankedOptions({ options }: { options: RankedFilterOptions }) {
  return (
    <>
      {options.featured.length > 0 ? (
        <optgroup label="よく登録されている">
          {options.featured.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </optgroup>
      ) : null}
      {options.alphabetical.length > 0 ? (
        <optgroup label="五十音順">
          {options.alphabetical.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </optgroup>
      ) : null}
    </>
  );
}

async function loadProductsByOrderedIds(orderedIds: number[]): Promise<ListedProduct[]> {
  if (orderedIds.length === 0) return [];

  const pageProducts = await prisma.product.findMany({
    where: { id: { in: orderedIds } },
    include: PRODUCT_INCLUDE,
  });
  const byId = new Map(pageProducts.map((product) => [product.id, product]));
  return orderedIds.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
}

async function loadProducts(
  where: Prisma.ProductWhereInput,
  sort: SortKey,
  currentPage: number,
  perPage: PageSize,
): Promise<ListedProduct[]> {
  const skip = (currentPage - 1) * perPage;

  if (isHistorySort(sort)) {
    const candidates = await prisma.product.findMany({
      where,
      select: {
        id: true,
        histories: {
          orderBy: { checkedAt: "desc" },
          take: 1,
          select: { checkedAt: true },
        },
      },
    });
    const orderedIds = sortProductIdsByLatestHistory(
      candidates,
      sort === "updated-desc" ? "desc" : "asc",
    ).slice(skip, skip + perPage);
    return loadProductsByOrderedIds(orderedIds);
  }

  if (!isSpreadSort(sort)) {
    return prisma.product.findMany({
      where,
      orderBy: SORT_ORDERS[sort],
      skip,
      take: perPage,
      include: PRODUCT_INCLUDE,
    });
  }

  const candidates = await prisma.product.findMany({
    where,
    select: {
      id: true,
      title: true,
      latestSalePrice: true,
      latestBuyPrice: true,
    },
  });
  const orderedIds = sortProductsByPriceSpread(
    candidates,
    sort === "spread-asc" ? "asc" : "desc",
  )
    .slice(skip, skip + perPage)
    .map((product) => product.id);
  return loadProductsByOrderedIds(orderedIds);
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const sort = parseSort(firstValue(query.sort));
  const perPage = parsePageSize(firstValue(query.perPage));
  const requestedPage = parsePositiveInteger(firstValue(query.page), 1);
  const filters = parseFilters(query);
  const filterSourceProducts = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      manufacturer: true,
      releaseDate: true,
      category: true,
      detailsJson: true,
    },
  });
  const filterCatalog = buildProductFilterCatalog(filterSourceProducts);
  const conditionTitleIds = conditionAnnotatedProductIds(filterSourceProducts);
  const where = buildProductWhere(filters, filterCatalog, conditionTitleIds);
  const filtersActive = hasActiveFilters(filters);
  const totalProducts = await prisma.product.count({ where });
  const allProducts = filterSourceProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));
  const currentPage = Math.min(requestedPage, totalPages);
  const products = await loadProducts(where, sort, currentPage, perPage);
  const firstShown = totalProducts === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const lastShown = Math.min(currentPage * perPage, totalProducts);
  const productPreviews: ProductPreview[] = products.map((product) => ({
    id: product.id,
    title: product.title,
    imageUrl: product.imageUrl,
    salePrice: product.latestSalePrice,
    buyPrice: product.latestBuyPrice,
    priceChangedAt:
      [product.salePriceChangedAt, product.buyPriceChangedAt]
        .filter((value): value is Date => value !== null)
        .sort((left, right) => right.getTime() - left.getTime())[0]
        ?.toISOString() ?? null,
    lastCheckedAt: product.histories[0]?.checkedAt.toISOString() ?? null,
    manufacturer: product.manufacturer,
    releaseDate: product.releaseDate,
    modelNumber: product.modelNumber,
    stockStatus: product.stockStatus,
    hasHistory: product.histories.length > 0,
    isNew: false,
  }));
  const advancedFiltersActive = [
    filters.brand,
    filters.os,
    filters.illustrator,
    filters.scenario,
    filters.voiceActor,
    filters.releaseYear,
    filters.saleBand,
    filters.buyBand,
    filters.stock,
    filters.conditionTitle,
    filters.detailLabel,
    filters.detailValue,
  ].some(Boolean);
  const streamEnabled = currentPage === 1 && !filtersActive && sort === "updated-desc";
  const selectedIntervalLabel = CRAWL_INTERVAL_OPTIONS.find(
    (option) => option.value === filters.crawlInterval,
  )?.label ?? "すべて";

  return (
    <section className="product-list-page">
      <div className="list-heading">
        <div>
          <h1>商品一覧</h1>
          <ProductListCount
            filtersActive={filtersActive}
            initialAllProducts={allProducts}
            initialFirstShown={firstShown}
            initialLastShown={lastShown}
            initialTotalProducts={totalProducts}
            perPage={perPage}
            streamEnabled={streamEnabled}
          />
        </div>
      </div>

      <div className={`card ${intervalStyles.panel}`}>
        <div className={intervalStyles.copy}>
          <span className={intervalStyles.title}>巡回周期で絞り込み</span>
          <span className={intervalStyles.description}>
            {filters.crawlInterval
              ? `${selectedIntervalLabel}設定の商品だけを表示中`
              : "周期を押すと、その日数に設定された商品だけを表示"}
          </span>
        </div>
        <div className={intervalStyles.buttons} role="group" aria-label="巡回周期で商品を絞り込み">
          {CRAWL_INTERVAL_OPTIONS.map((option) => {
            const selected = option.value === filters.crawlInterval;
            return (
              <Link
                aria-current={selected ? "page" : undefined}
                className={intervalStyles.button}
                data-selected={selected ? "true" : "false"}
                data-tone={option.tone}
                href={listUrl(1, sort, perPage, {
                  ...filters,
                  crawlInterval: option.value,
                })}
                key={option.value || "all"}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </div>

      <form action="/products" className="card filter-panel">
        <input name="crawlInterval" type="hidden" value={filters.crawlInterval} />
        {filters.detailLabel && filters.detailValue ? (
          <div className="linked-detail-filter">
            <span>商品詳細: {filters.detailLabel}「{filters.detailValue}」</span>
            <Link
              href={listUrl(1, sort, perPage, {
                ...filters,
                detailLabel: "",
                detailValue: "",
              })}
            >
              解除
            </Link>
            <input name="detailLabel" type="hidden" value={filters.detailLabel} />
            <input name="detailValue" type="hidden" value={filters.detailValue} />
          </div>
        ) : null}
        <div className="primary-search-grid">
          <label className="filter-field primary-name-search">
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
          <button className="primary-search-button" type="submit">検索</button>
          <Link className="button secondary primary-clear-button" href="/products">
            クリア
          </Link>
        </div>

        <details className="advanced-search" open={advancedFiltersActive}>
          <summary>
            <span>詳細検索</span>
            {advancedFiltersActive ? <span className="active-filter-label">条件設定中</span> : null}
          </summary>
          <div className="filter-grid advanced-filter-grid">
            <label className="filter-field">
              <span>ブランド</span>
              <select className="select" defaultValue={filters.brand} name="brand">
                <option value="">すべて</option>
                <RankedOptions options={filterCatalog.brands.options} />
              </select>
            </label>
            <label className="filter-field">
              <span>OS</span>
              <select className="select" defaultValue={filters.os} name="os">
                <option value="">すべて</option>
                {filterCatalog.operatingSystems.options.alphabetical.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>原画</span>
              <select className="select" defaultValue={filters.illustrator} name="illustrator">
                <option value="">すべて</option>
                <RankedOptions options={filterCatalog.illustrators.options} />
              </select>
            </label>
            <label className="filter-field">
              <span>シナリオ</span>
              <select className="select" defaultValue={filters.scenario} name="scenario">
                <option value="">すべて</option>
                <RankedOptions options={filterCatalog.scenarios.options} />
              </select>
            </label>
            <label className="filter-field">
              <span>声優</span>
              <select className="select" defaultValue={filters.voiceActor} name="voiceActor">
                <option value="">すべて</option>
                <RankedOptions options={filterCatalog.voiceActors.options} />
              </select>
            </label>
            <label className="filter-field">
              <span>発売年度</span>
              <select className="select" defaultValue={filters.releaseYear} name="releaseYear">
                <option value="">すべて</option>
                {filterCatalog.releaseYears.map((year) => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>販売価格帯</span>
              <select className="select" defaultValue={filters.saleBand} name="saleBand">
                <option value="">すべて</option>
                {PRICE_BANDS.map((band) => (
                  <option key={band.value} value={band.value}>{band.label}</option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>買取価格帯</span>
              <select className="select" defaultValue={filters.buyBand} name="buyBand">
                <option value="">すべて</option>
                {PRICE_BANDS.map((band) => (
                  <option key={band.value} value={band.value}>{band.label}</option>
                ))}
              </select>
            </label>
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
              <span>タイトルの状態表記</span>
              <select
                className="select"
                defaultValue={filters.conditionTitle}
                name="conditionTitle"
              >
                <option value="">すべて</option>
                <option value="exclude">「(状態：...)」付き商品を除外</option>
              </select>
            </label>
          </div>
        </details>
      </form>

      <ProductGrid
        filtersActive={filtersActive}
        initialProducts={productPreviews}
        perPage={perPage}
        streamEnabled={streamEnabled}
      />

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
    </section>
  );
}
