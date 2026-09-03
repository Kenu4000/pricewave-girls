export default function AutomationRunPage() {
  return (
    <section className="card" style={{ maxWidth: 760, margin: "40px auto" }}>
      <h1>Pricewave 自動更新</h1>
      <p id="pricewave-automation-status" role="status">
        拡張機能から巡回開始を待っています…
      </p>
      <p className="muted">
        巡回が完了すると、自動的にViewerのスナップショットを生成してgh-pagesへ公開します。
      </p>
    </section>
  );
}
