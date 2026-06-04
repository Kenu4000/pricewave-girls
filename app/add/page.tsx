import { AddProductForm } from "@/components/AddProductForm";

export default function AddProductPage() {
  return (
    <section className="form">
      <div>
        <h1>商品追加</h1>
        <p className="muted">駿河屋のPCゲーム商品URLを登録して、最初の価格履歴を保存します。</p>
      </div>
      <AddProductForm />
    </section>
  );
}
