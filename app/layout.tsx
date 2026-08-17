import type { Metadata } from "next";
import { LiveRefresh } from "@/app/live-refresh";
import { BrandFeaturedGroupLabel } from "@/components/BrandFeaturedGroupLabel";
import { TimeSaleCountdown } from "@/components/TimeSaleCountdown";
import { ViewedProductTracker } from "@/components/ViewedProductTracker";
import { prisma } from "@/lib/prisma";
import "./globals.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "駿河屋価格トラッキング",
  description: "個人利用向けの駿河屋価格記録Webアプリ",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const now = new Date();
  const nearestSale = await prisma.product.findFirst({
    where: {
      isTimeSale: true,
      timeSaleEndsAt: { gt: now },
    },
    orderBy: { timeSaleEndsAt: "asc" },
    select: { timeSaleEndsAt: true },
  });
  const nearestEndAt = nearestSale?.timeSaleEndsAt ?? null;
  const anotherEndTime = nearestEndAt
    ? await prisma.product.findFirst({
        where: {
          isTimeSale: true,
          timeSaleEndsAt: { gt: now, not: nearestEndAt },
        },
        select: { id: true },
      })
    : null;

  return (
    <html lang="ja">
      <body>
        <LiveRefresh />
        <ViewedProductTracker />
        <BrandFeaturedGroupLabel />
        <main className="container">
          <header className="header">
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a className="brand" href="/products" title="初期画面に戻る">
                駿河屋価格トラッキング
              </a>
              {nearestEndAt !== null ? (
                <TimeSaleCountdown
                  endAt={nearestEndAt.toISOString()}
                  initialNow={now.toISOString()}
                  multipleEndTimes={anotherEndTime !== null}
                />
              ) : null}
            </div>
            <nav className="header-nav" aria-label="主要ページ">
              <a className="button secondary" href="/changes">価格変更</a>
              <a className="button secondary" href="/history">履歴</a>
              <a className="button secondary" href="/requests">リクエスト</a>
              <a className="button secondary" href="/crawl-review">周期振り分け</a>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
