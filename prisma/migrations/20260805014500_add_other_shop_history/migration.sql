ALTER TABLE "JunkHistory" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'alternate_condition';
ALTER TABLE "JunkHistory" ADD COLUMN "storeName" TEXT;

CREATE INDEX "JunkHistory_productId_sourceType_checkedAt_idx"
ON "JunkHistory"("productId", "sourceType", "checkedAt");

CREATE INDEX "JunkHistory_storeName_idx"
ON "JunkHistory"("storeName");
