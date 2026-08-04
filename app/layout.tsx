import type { Metadata } from "next";
import Link from "next/link";
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
            <Link className="brand" href="/products">
              駿河屋価格トラッキング
            </Link>
            <nav className="nav" aria-label="メインナビゲーション">
              <Link className="button secondary" href="/products">
                商品一覧
              </Link>
              <Link className="button" href="/add">
                商品追加
              </Link>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
