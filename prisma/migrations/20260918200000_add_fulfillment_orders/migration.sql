-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACKNOWLEDGED', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FulfillmentOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "externalOrderId" TEXT,
    "supplierOrderNumber" TEXT,
    "totalCostSnapshot" DECIMAL(10,2) NOT NULL,
    "subtotalCostSnapshot" DECIMAL(10,2) NOT NULL,
    "shippingCostSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "failureReason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentItem" (
    "id" TEXT NOT NULL,
    "fulfillmentOrderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostSnapshot" DECIMAL(10,2) NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentHistory" (
    "id" TEXT NOT NULL,
    "fulfillmentOrderId" TEXT NOT NULL,
    "previousStatus" "FulfillmentStatus" NOT NULL,
    "newStatus" "FulfillmentStatus" NOT NULL,
    "reason" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfillmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentOrder_orderId_supplierId_key" ON "FulfillmentOrder"("orderId", "supplierId");
CREATE INDEX "FulfillmentOrder_orderId_idx" ON "FulfillmentOrder"("orderId");
CREATE INDEX "FulfillmentOrder_supplierId_idx" ON "FulfillmentOrder"("supplierId");
CREATE INDEX "FulfillmentOrder_status_idx" ON "FulfillmentOrder"("status");
CREATE INDEX "FulfillmentOrder_externalOrderId_idx" ON "FulfillmentOrder"("externalOrderId");
CREATE INDEX "FulfillmentOrder_nextAttemptAt_idx" ON "FulfillmentOrder"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "FulfillmentItem_fulfillmentOrderId_idx" ON "FulfillmentItem"("fulfillmentOrderId");
CREATE INDEX "FulfillmentItem_orderItemId_idx" ON "FulfillmentItem"("orderItemId");

-- CreateIndex
CREATE INDEX "FulfillmentHistory_fulfillmentOrderId_idx" ON "FulfillmentHistory"("fulfillmentOrderId");
CREATE INDEX "FulfillmentHistory_createdAt_idx" ON "FulfillmentHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "FulfillmentOrder" ADD CONSTRAINT "FulfillmentOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentOrder" ADD CONSTRAINT "FulfillmentOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_fulfillmentOrderId_fkey" FOREIGN KEY ("fulfillmentOrderId") REFERENCES "FulfillmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentHistory" ADD CONSTRAINT "FulfillmentHistory_fulfillmentOrderId_fkey" FOREIGN KEY ("fulfillmentOrderId") REFERENCES "FulfillmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
