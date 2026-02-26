-- CreateTable
CREATE TABLE "Administration" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "roleKey" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Administration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Administration_roleKey_idx" ON "Administration"("roleKey");

-- CreateIndex
CREATE INDEX "Administration_isActive_idx" ON "Administration"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Administration_memberId_roleKey_key" ON "Administration"("memberId", "roleKey");

-- AddForeignKey
ALTER TABLE "Administration" ADD CONSTRAINT "Administration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
