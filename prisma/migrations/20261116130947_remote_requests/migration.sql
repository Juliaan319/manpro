-- AlterEnum
ALTER TYPE "PCStatus" ADD VALUE 'REMOTE';

-- CreateTable
CREATE TABLE "RemoteRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "accessUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemotePolicy" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "templateUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemotePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemoteRequest_pcId_startAt_endAt_idx" ON "RemoteRequest"("pcId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "RemoteRequest_userId_status_idx" ON "RemoteRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "RemoteRequest" ADD CONSTRAINT "RemoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteRequest" ADD CONSTRAINT "RemoteRequest_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "PC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteRequest" ADD CONSTRAINT "RemoteRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
