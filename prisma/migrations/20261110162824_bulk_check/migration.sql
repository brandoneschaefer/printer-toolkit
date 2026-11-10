-- CreateEnum
CREATE TYPE "BulkCheckStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "BulkCheck" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT,
    "status" "BulkCheckStatus" NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "exposedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkCheckDomain" (
    "id" TEXT NOT NULL,
    "bulkId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "exposed" BOOLEAN NOT NULL DEFAULT false,
    "ips" INTEGER NOT NULL DEFAULT 0,
    "subdomains" INTEGER NOT NULL DEFAULT 0,
    "findings" INTEGER NOT NULL DEFAULT 0,
    "top" TEXT,

    CONSTRAINT "BulkCheckDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkCheck_orgId_idx" ON "BulkCheck"("orgId");

-- CreateIndex
CREATE INDEX "BulkCheckDomain_bulkId_idx" ON "BulkCheckDomain"("bulkId");

-- AddForeignKey
ALTER TABLE "BulkCheck" ADD CONSTRAINT "BulkCheck_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkCheckDomain" ADD CONSTRAINT "BulkCheckDomain_bulkId_fkey" FOREIGN KEY ("bulkId") REFERENCES "BulkCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
