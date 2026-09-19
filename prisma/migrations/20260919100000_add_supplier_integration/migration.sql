-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'CONFIGURED', 'ACTIVE', 'ERROR', 'DISABLED');

-- CreateTable
CREATE TABLE "SupplierIntegration" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'TEST',
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "encryptedCredentials" TEXT,
    "configurationJson" JSONB,
    "lastTestedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierIntegration_supplierId_key" ON "SupplierIntegration"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierIntegration_provider_idx" ON "SupplierIntegration"("provider");

-- CreateIndex
CREATE INDEX "SupplierIntegration_status_idx" ON "SupplierIntegration"("status");

-- AddForeignKey
ALTER TABLE "SupplierIntegration" ADD CONSTRAINT "SupplierIntegration_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
