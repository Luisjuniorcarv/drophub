-- DropIndex
DROP INDEX IF EXISTS "Payment_idempotencyKey_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
