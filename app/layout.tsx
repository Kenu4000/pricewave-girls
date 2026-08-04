import type { Metadata } from "next";
import { LiveRefresh } from "@/app/live-refresh";
import "./globals.css";

export const metadata: Metadata = {
  title: "駿河屋価格トラッキング",
  description: "個人利用向けの駿河屋価格記録Webアプリ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <LiveRefresh />
        <main className="container">
          <header className="header">
            <a className="brand" href="/products" title="初期画面に戻る">
              駿河屋価格トラッキング
            </a>
            <nav className="header-nav" aria-label="主要ページ">
              <a className="button secondary" href="/changes">価格変更</a>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
