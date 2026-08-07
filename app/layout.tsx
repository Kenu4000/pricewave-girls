import type { Metadata } from "next";
import { LiveRefresh } from "@/app/live-refresh";
import { TimeSaleCountdown } from "@/components/TimeSaleCountdown";
import { ViewedProductTracker } from "@/components/ViewedProductTracker";
import { prisma } from "@/lib/prisma";
import "./globals.css";

export const metadata: Metadata = {
  title: "駿河屋価格トラッキング",
  description: "個人利用向けの駿河屋価格記録Webアプリ",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const now = new Date();
  const activeSaleEnds = await prisma.product.findMany({
    where: {
      isTimeSale: true,
      timeSaleEndsAt: { gt: now },
    },
    orderBy: { timeSaleEndsAt: "asc" },
    select: { timeSaleEndsAt: true },
  });
  const uniqueEndTimes = [
    ...new Set(
      activeSaleEnds
        .flatMap((product) => (product.timeSaleEndsAt ? [product.timeSaleEndsAt.getTime()] : [])),
    ),
  ].sort((left, right) => left - right);
  const nearestEndAt = uniqueEndTimes[0] ?? null;

  return (
    <html lang="ja">
      <body>
        <LiveRefresh />
        <ViewedProductTracker />
        <main className="container">
          <header className="header">
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a className="brand" href="/products" title="初期画面に戻る">
                駿河屋価格トラッキング
              </a>
              {nearestEndAt !== null ? (
                <TimeSaleCountdown
                  endAt={new Date(nearestEndAt).toISOString()}
                  multipleEndTimes={uniqueEndTimes.length > 1}
                />
              ) : null}
            </div>
            <nav className="header-nav" aria-label="主要ページ">
              <a className="button secondary" href="/changes">価格変更</a>
              <a className="button secondary" href="/history">履歴</a>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
