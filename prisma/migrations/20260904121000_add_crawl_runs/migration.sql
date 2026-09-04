CREATE TABLE "CrawlRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "total" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "viewerPublishStatus" TEXT,
    "viewerPublishedAt" DATETIME,
    "viewerPublishMessage" TEXT
);

CREATE INDEX "CrawlRun_startedAt_idx" ON "CrawlRun"("startedAt");
CREATE INDEX "CrawlRun_status_startedAt_idx" ON "CrawlRun"("status", "startedAt");
