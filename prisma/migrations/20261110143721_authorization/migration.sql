-- CreateTable
CREATE TABLE "Authorization" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT,
    "signerEmail" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "Authorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Authorization_orgId_idx" ON "Authorization"("orgId");

-- AddForeignKey
ALTER TABLE "Authorization" ADD CONSTRAINT "Authorization_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
