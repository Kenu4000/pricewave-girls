-- 商品ごとに自動巡回周期を持つ。NULL は自動巡回なし。
-- DEFAULT 1 により既存商品も新規商品も初期値を1日とする。
ALTER TABLE "Product" ADD COLUMN "crawlIntervalDays" INTEGER DEFAULT 1;

CREATE INDEX "Product_crawlIntervalDays_idx" ON "Product"("crawlIntervalDays");
