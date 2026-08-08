import Link from "next/link";
import { ClearSmallPriceChangesButton } from "@/app/changes/ClearSmallPriceChangesButton";
import { DeletePriceChangeButton } from "@/app/changes/DeletePriceChangeButton";
import {
  getPriceChangeBrands,
  getPriceChangeEvents,
  type PriceChangeDirection,
  type PriceChangeFilters,
  type PriceChangeType,
} from "@/lib/price-change-events";
import { normalizeFilterChoiceValue } from "@/lib/product-filter-options";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const TYPE_OPTIONS = [
  { value: "all", label: "販売・買取すべて" },
  { value: "sale", label: "販売価格のみ" },
  { value: "buy", label: "買取価格のみ" },
] as const;
const DIRECTION_OPTIONS = [
  { value: "all", label: "値上げ・値下がりすべて" },
  { value: "up", label: "値上げのみ" },
  { value: "down", label: "値下がりのみ" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseType(value: string | undefined): PriceChangeType {
  return TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as PriceChangeType)
    : "all";
}

function parseDirection(value: string | undefined): PriceChangeDirection {
  return DIRECTION_OPTIONS.some((option) => option.value === value)
    ? (value as PriceChangeDirection)
    : "all";
}

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeFilterText(value: string | undefined, maxLength: number) {
  return (value ?? "").trim().slice(0, maxLength);
}

function formatPrice(price: number | null) {
  return price === null ? "未取得" : `${price.toLocaleString("ja-JP")}円`;
}

function pageUrl(page: number, filters: PriceChangeFilters) {
  const params = new URLSearchParams();
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.direction !== "all") params.set("direction", filters.direction);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.query) params.set("q", filters.query);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/changes?${query}` : "/changes";
}

export default async function PriceChangesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const rawBrand = normalizeFilterText(firstValue(query.brand), 120);
  const filters: PriceChangeFilters = {
    type: parseType(firstValue(query.type)),
    direction: parseDirection(firstValue(query.direction)),
    brand: rawBrand ? normalizeFilterChoiceValue(rawBrand) : "",
    query: normalizeFilterText(firstValue(query.q), 200),
  };
  const requestedPage = parsePage(firstValue(query.page));
  const [brands, firstResult] = await Promise.all([
    getPriceChangeBrands(),
    getPriceChangeEvents(
      filters,
      (requestedPage - 1) * PAGE_SIZE,
      PAGE_SIZE,
    ),
  ]);
  const totalPages = Math.max(1, Math.ceil(firstResult.total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const result =
    currentPage === requestedPage
      ? firstResult
      : await getPriceChangeEvents(
          filters,
          (currentPage - 1) * PAGE_SIZE,
          PAGE_SIZE,
        );

  return (
    <section className="price-changes-page">
      <div className="list-heading">
        <div>
          <h1>価格変更</h1>
          <p className="muted">
            条件に一致する価格変更 {result.total.toLocaleString("ja-JP")}件
          </p>
        </div>
        <ClearSmallPriceChangesButton />
      </div>

      <form action="/changes" className="card change-filter-form">
        <label className="filter-field change-filter-query">
          <span>商品名</span>
          <input
            className="input"
            defaultValue={filters.query}
            maxLength={200}
            name="q"
            placeholder="商品名の一部を入力"
            type="search"
          />
        </label>
        <label className="filter-field change-filter-brand">
          <span>ブランド</span>
          <select className="select" defaultValue={filters.brand} name="brand">
            <option value="">すべてのブランド</option>
            {brands.featured.length > 0 ? (
              <optgroup label="よく登録されている">
                {brands.featured.map((brand) => (
                  <option key={brand.value} value={brand.value}>{brand.label}</option>
                ))}
              </optgroup>
            ) : null}
            {brands.alphabetical.length > 0 ? (
              <optgroup label="五十音順">
                {brands.alphabetical.map((brand) => (
                  <option key={brand.value} value={brand.value}>{brand.label}</option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <label className="filter-field change-filter-type">
          <span>価格の種類</span>
          <select className="select" defaultValue={filters.type} name="type">
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="filter-field change-filter-direction">
          <span>値動き</span>
          <select className="select" defaultValue={filters.direction} name="direction">
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="change-filter-actions">
          <button type="submit">絞り込む</button>
          <Link className="button secondary" href="/changes">クリア</Link>
        </div>
      </form>

      {result.events.length > 0 ? (
        <div className="card table-wrap price-change-list-wrap">
          <table className="price-change-table">
            <thead>
              <tr>
                <th>変更日時</th>
                <th>商品</th>
                <th>ブランド</th>
                <th>種類</th>
                <th>変更前</th>
                <th>変更後</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {result.events.map((event) => (
                <tr key={event.id}>
                  <td data-label="変更日時">{event.changedAt.toLocaleString("ja-JP")}</td>
                  <td className="price-change-product-cell" data-label="商品">
                    <Link className="change-product-link" href={`/products/${event.productId}`}>
                      {event.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={event.imageUrl} />
                      ) : null}
                      <span>{event.title}</span>
                    </Link>
                  </td>
                  <td data-label="ブランド">
                    {event.manufacturer ?? <span className="muted">未取得</span>}
                  </td>
                  <td data-label="種類">
                    <span className={`change-type-badge ${event.type}`}>
                      {event.type === "sale" ? "販売" : "買取"}
                    </span>
                  </td>
                  <td data-label="変更前">{formatPrice(event.previousPrice)}</td>
                  <td className="price-change-current" data-label="変更後">
                    {formatPrice(event.currentPrice)}
                  </td>
                  <td className="price-change-action-cell" data-label="操作">
                    <DeletePriceChangeButton priceChangeId={event.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card"><p>条件に一致する価格変更はありません。</p></div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="価格変更のページ" className="pagination">
          <Link
            aria-disabled={currentPage === 1}
            className={`page-link ${currentPage === 1 ? "disabled" : ""}`}
            href={pageUrl(Math.max(1, currentPage - 1), filters)}
          >
            ← 前へ
          </Link>
          <span className="page-link current">{currentPage} / {totalPages}</span>
          <Link
            aria-disabled={currentPage === totalPages}
            className={`page-link ${currentPage === totalPages ? "disabled" : ""}`}
            href={pageUrl(Math.min(totalPages, currentPage + 1), filters)}
          >
            次へ →
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
