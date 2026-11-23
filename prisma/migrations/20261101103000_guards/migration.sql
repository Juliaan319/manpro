CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "PCBorrowRequest" ADD CONSTRAINT "request_valid_interval" CHECK ("endAt" > "startAt");
ALTER TABLE "PCBorrowRequest" ADD CONSTRAINT "approved_pc_no_overlap" EXCLUDE USING gist ("pcId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&) WHERE (status = 'APPROVED');
CREATE UNIQUE INDEX "one_active_session_per_user" ON "AttendanceSession" ("userId") WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX "one_active_session_per_pc" ON "AttendanceSession" ("pcId") WHERE status = 'ACTIVE' AND "pcId" IS NOT NULL;
