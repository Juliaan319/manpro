ALTER TABLE "AttendanceSession" ADD COLUMN "attendanceDay" TEXT;
CREATE UNIQUE INDEX "AttendanceSession_userId_laboratoryId_attendanceDay_key" ON "AttendanceSession"("userId","laboratoryId","attendanceDay");
