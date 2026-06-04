-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "surugayaUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "latestSalePrice" INTEGER,
    "latestBuyPrice" INTEGER,
    "stockStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "salePrice" INTEGER,
    "buyPrice" INTEGER,
    "stockStatus" TEXT,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_surugayaUrl_key" ON "Product"("surugayaUrl");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_checkedAt_idx" ON "PriceHistory"("productId", "checkedAt");
