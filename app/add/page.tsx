import { AddProductForm } from "@/components/AddProductForm";

export default function AddProductPage() {
  return (
    <section className="form">
      <div>
        <h1>商品追加</h1>
        <p className="muted">駿河屋の商品ページから、最初の価格履歴を保存します。</p>
      </div>

      <section className="card form">
        <div>
          <h2>Edge拡張機能から記録（推奨）</h2>
          <p className="muted">
            自動取得がアクセス確認で止まる場合も、通常のEdgeで表示できた商品ページを記録できます。
          </p>
        </div>
        <ol className="steps">
          <li>Edgeで <code>edge://extensions</code> を開く</li>
          <li>「開発者モード」をオンにして「展開して読み込み」を押す</li>
          <li><code>pricewave-girls\browser-extension</code> フォルダーを選ぶ</li>
          <li>駿河屋の商品詳細ページを開き、拡張機能の「この商品を記録」を押す</li>
        </ol>
      </section>

      <div>
        <h2>自動取得を試す</h2>
        <p className="muted">アクセス確認が出ない環境でのみ使用できます。</p>
      </div>
      <AddProductForm />
    </section>
  );
}
