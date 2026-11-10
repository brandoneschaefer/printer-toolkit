-- CreateEnum
CREATE TYPE "ScanExecutor" AS ENUM ('CLOUD', 'COLLECTOR');

-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "collectorId" TEXT,
ADD COLUMN     "executor" "ScanExecutor" NOT NULL DEFAULT 'CLOUD';

-- CreateTable
CREATE TABLE "Collector" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Collector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collector_orgId_idx" ON "Collector"("orgId");

-- AddForeignKey
ALTER TABLE "Collector" ADD CONSTRAINT "Collector_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
