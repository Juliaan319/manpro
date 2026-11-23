-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'LAB_ADMIN', 'HEAD_LAB');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('STUDENT', 'LECTURER', 'STAFF', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "PCStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'IN_USE', 'MAINTENANCE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CORRECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "userType" "UserType" NOT NULL,
    "identity" TEXT,
    "institution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Laboratory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Laboratory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PC" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "laboratoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cpu" TEXT NOT NULL,
    "ram" TEXT NOT NULL,
    "gpu" TEXT,
    "vram" INTEGER,
    "status" "PCStatus" NOT NULL DEFAULT 'AVAILABLE',
    "monitoring" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PCBorrowRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "laboratoryId" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PCBorrowRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "laboratoryId" TEXT NOT NULL,
    "pcId" TEXT,
    "reservationId" TEXT,
    "purpose" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOut" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PCTelemetry" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "cpuPercent" DOUBLE PRECISION,
    "ramPercent" DOUBLE PRECISION,
    "gpuName" TEXT,
    "gpuPercent" DOUBLE PRECISION,
    "gpuMemoryUsed" DOUBLE PRECISION,
    "gpuMemoryTotal" DOUBLE PRECISION,
    "gpuTemperature" DOUBLE PRECISION,
    "gpuPower" DOUBLE PRECISION,

    CONSTRAINT "PCTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCredential" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_identity_key" ON "User"("identity");

-- CreateIndex
CREATE UNIQUE INDEX "Laboratory_code_key" ON "Laboratory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PC_code_key" ON "PC"("code");

-- CreateIndex
CREATE INDEX "PCBorrowRequest_pcId_startAt_endAt_idx" ON "PCBorrowRequest"("pcId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "PCBorrowRequest_userId_status_idx" ON "PCBorrowRequest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_reservationId_key" ON "AttendanceSession"("reservationId");

-- CreateIndex
CREATE INDEX "AttendanceSession_laboratoryId_checkIn_idx" ON "AttendanceSession"("laboratoryId", "checkIn");

-- CreateIndex
CREATE INDEX "PCTelemetry_pcId_recordedAt_idx" ON "PCTelemetry"("pcId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCredential_pcId_key" ON "DeviceCredential"("pcId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PC" ADD CONSTRAINT "PC_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Laboratory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PCBorrowRequest" ADD CONSTRAINT "PCBorrowRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PCBorrowRequest" ADD CONSTRAINT "PCBorrowRequest_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Laboratory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PCBorrowRequest" ADD CONSTRAINT "PCBorrowRequest_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "PC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PCBorrowRequest" ADD CONSTRAINT "PCBorrowRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Laboratory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "PC"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "PCBorrowRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PCTelemetry" ADD CONSTRAINT "PCTelemetry_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "PC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCredential" ADD CONSTRAINT "DeviceCredential_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "PC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
