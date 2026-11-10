-- CreateTable
CREATE TABLE "ExposureReport" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "exposed" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExposureReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExposureReport_token_key" ON "ExposureReport"("token");

-- CreateIndex
CREATE INDEX "ExposureReport_orgId_idx" ON "ExposureReport"("orgId");

-- AddForeignKey
ALTER TABLE "ExposureReport" ADD CONSTRAINT "ExposureReport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
