-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_trackingToken_key" ON "Order"("trackingToken");
