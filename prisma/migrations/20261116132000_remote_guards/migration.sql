ALTER TABLE "RemoteRequest" ADD CONSTRAINT remote_interval_valid CHECK ("endAt">"startAt");
ALTER TABLE "RemoteRequest" ADD CONSTRAINT remote_file_size CHECK (octet_length("fileBytes") BETWEEN 1 AND 5242880);
ALTER TABLE "RemoteRequest" ADD CONSTRAINT remote_no_overlap EXCLUDE USING gist ("pcId" WITH =,tstzrange("startAt","endAt",'[)') WITH &&) WHERE(status='APPROVED');
CREATE FUNCTION guard_pc_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='APPROVED' THEN
  PERFORM id FROM "PC" WHERE id=NEW."pcId" FOR UPDATE;
  IF TG_TABLE_NAME='RemoteRequest' THEN
   IF EXISTS(SELECT 1 FROM "PCBorrowRequest" WHERE "pcId"=NEW."pcId" AND status='APPROVED' AND "startAt"<NEW."endAt" AND "endAt">NEW."startAt") THEN RAISE EXCEPTION 'PC booking conflict' USING ERRCODE='23P01'; END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM "RemoteRequest" WHERE "pcId"=NEW."pcId" AND status='APPROVED' AND "startAt"<NEW."endAt" AND "endAt">NEW."startAt") THEN RAISE EXCEPTION 'PC remote conflict' USING ERRCODE='23P01'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER guard_remote_booking BEFORE INSERT OR UPDATE OF status,"pcId","startAt","endAt" ON "RemoteRequest" FOR EACH ROW EXECUTE FUNCTION guard_pc_booking();
CREATE TRIGGER guard_local_booking BEFORE INSERT OR UPDATE OF status,"pcId","startAt","endAt" ON "PCBorrowRequest" FOR EACH ROW EXECUTE FUNCTION guard_pc_booking();
