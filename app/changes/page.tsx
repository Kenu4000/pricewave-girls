import Link from "next/link";
import { DeletePriceChangeButton } from "@/app/changes/DeletePriceChangeButton";
import {
  getPriceChangeBrands,
  getPriceChangeEvents,
  type PriceChangeFilters,
  type PriceChangeType,
} from "@/lib/price-change-events";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const TYPE_OPTIONS = [
  { value: "all", label: "販売・買取すべて" },
  { value: "sale", label: "販売価格のみ" },
  { value: "buy", label: "買取価格のみ" },
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
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.query) params.set("q", filters.query);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/changes?${query}` : "/changes";
}

export default async function PriceChangesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const filters: PriceChangeFilters = {
    type: parseType(firstValue(query.type)),
    brand: normalizeFilterText(firstValue(query.brand), 120),
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
  const brandOptions =
    filters.brand && !brands.includes(filters.brand)
      ? [filters.brand, ...brands]
      : brands;
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
      </div>

      <form
        action="/changes"
        className="card change-filter-form"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          justifyContent: "stretch",
          width: "100%",
        }}
      >
        <label className="filter-field">
          <span>商品名</span>
          <input
            className="input"
            defaultValue={filters.query}
            maxLength={200}
            name="q"
            placeholder="商品名の一部を入力"
            style={{ padding: "10px 12px" }}
            type="search"
          />
        </label>
        <label className="filter-field">
          <span>ブランド</span>
          <select className="select" defaultValue={filters.brand} name="brand">
            <option value="">すべてのブランド</option>
            {brandOptions.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>価格の種類</span>
          <select className="select" defaultValue={filters.type} name="type">
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="submit">絞り込む</button>
          <Link className="button secondary" href="/changes">クリア</Link>
        </div>
      </form>

      {result.events.length > 0 ? (
        <div className="card table-wrap">
          <table className="price-change-table" style={{ minWidth: 980 }}>
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
                  <td>{event.changedAt.toLocaleString("ja-JP")}</td>
                  <td>
                    <Link className="change-product-link" href={`/products/${event.productId}`}>
                      {event.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={event.imageUrl} />
                      ) : null}
                      <span>{event.title}</span>
                    </Link>
                  </td>
                  <td>{event.manufacturer ?? <span className="muted">未取得</span>}</td>
                  <td>
                    <span className={`change-type-badge ${event.type}`}>
                      {event.type === "sale" ? "販売" : "買取"}
                    </span>
                  </td>
                  <td>{formatPrice(event.previousPrice)}</td>
                  <td>{formatPrice(event.currentPrice)}</td>
                  <td>
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
