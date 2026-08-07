import { HistoryProducts } from "@/app/history/HistoryProducts";

export default function HistoryPage() {
  return (
    <section className="product-list-page">
      <div className="list-heading">
        <div>
          <h1>閲覧履歴</h1>
          <p className="muted">最近見た商品を新しい順に表示します。</p>
        </div>
      </div>
      <HistoryProducts />
    </section>
  );
}
