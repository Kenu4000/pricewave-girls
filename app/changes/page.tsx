import Link from "next/link";
import {
  getPriceChangeEvents,
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

function formatPrice(price: number | null) {
  return price === null ? "未取得" : `${price.toLocaleString("ja-JP")}円`;
}

function pageUrl(page: number, type: PriceChangeType) {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/changes?${query}` : "/changes";
}

export default async function PriceChangesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const type = parseType(firstValue(query.type));
  const requestedPage = parsePage(firstValue(query.page));
  const firstResult = await getPriceChangeEvents(
    type,
    (requestedPage - 1) * PAGE_SIZE,
    PAGE_SIZE,
  );
  const totalPages = Math.max(1, Math.ceil(firstResult.total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const result =
    currentPage === requestedPage
      ? firstResult
      : await getPriceChangeEvents(type, (currentPage - 1) * PAGE_SIZE, PAGE_SIZE);

  return (
    <section className="price-changes-page">
      <div className="list-heading">
        <div>
          <h1>価格変更</h1>
          <p className="muted">直近の価格変更 {result.total.toLocaleString("ja-JP")}件</p>
        </div>
      </div>

      <form action="/changes" className="card change-filter-form">
        <label className="filter-field">
          <span>価格の種類</span>
          <select className="select" defaultValue={type} name="type">
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="submit">絞り込む</button>
      </form>

      {result.events.length > 0 ? (
        <div className="card table-wrap">
          <table className="price-change-table">
            <thead>
              <tr>
                <th>変更日時</th>
                <th>商品</th>
                <th>種類</th>
                <th>変更前</th>
                <th>変更後</th>
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
                  <td>
                    <span className={`change-type-badge ${event.type}`}>
                      {event.type === "sale" ? "販売" : "買取"}
                    </span>
                  </td>
                  <td>{formatPrice(event.previousPrice)}</td>
                  <td>{formatPrice(event.currentPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card"><p>記録済みの価格変更はありません。</p></div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="価格変更のページ" className="pagination">
          <Link
            aria-disabled={currentPage === 1}
            className={`page-link ${currentPage === 1 ? "disabled" : ""}`}
            href={pageUrl(Math.max(1, currentPage - 1), type)}
          >
            ← 前へ
          </Link>
          <span className="page-link current">{currentPage} / {totalPages}</span>
          <Link
            aria-disabled={currentPage === totalPages}
            className={`page-link ${currentPage === totalPages ? "disabled" : ""}`}
            href={pageUrl(Math.min(totalPages, currentPage + 1), type)}
          >
            次へ →
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
