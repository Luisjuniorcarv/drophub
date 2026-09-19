-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'INACTIVE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "brand" TEXT,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "minPrice" DECIMAL(10,2),
ADD COLUMN "maxPrice" DECIMAL(10,2),
ADD COLUMN "targetMargin" DECIMAL(5,2),
ADD COLUMN "targetMarkup" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "externalProductId" TEXT,
    "externalSku" TEXT,
    "supplierUrl" TEXT,
    "supplierCost" DECIMAL(10,2) NOT NULL,
    "supplierStock" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalListingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNPUBLISHED',
    "marketplacePrice" DECIMAL(10,2),
    "marketplaceStock" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAuditLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_productId_supplierId_key" ON "SupplierProduct"("productId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierProduct_productId_idx" ON "SupplierProduct"("productId");

-- CreateIndex
CREATE INDEX "SupplierProduct_supplierId_idx" ON "SupplierProduct"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierProduct_externalSku_idx" ON "SupplierProduct"("externalSku");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceListing_productId_channel_key" ON "MarketplaceListing"("productId", "channel");

-- CreateIndex
CREATE INDEX "MarketplaceListing_productId_idx" ON "MarketplaceListing"("productId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_channel_idx" ON "MarketplaceListing"("channel");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");

-- CreateIndex
CREATE INDEX "ProductAuditLog_productId_idx" ON "ProductAuditLog"("productId");

-- CreateIndex
CREATE INDEX "ProductAuditLog_createdAt_idx" ON "ProductAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ProductAuditLog_field_idx" ON "ProductAuditLog"("field");

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAuditLog" ADD CONSTRAINT "ProductAuditLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAuditLog" ADD CONSTRAINT "ProductAuditLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
