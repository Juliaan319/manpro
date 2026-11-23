import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  it,
  expect,
  vi,
} from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import { requestRemote, reviewRemote, cancelRemote } from "../src/lib/remote";
import { reserve, review } from "../src/lib/service";
const current = vi.hoisted(() => ({
  user: { id: "", role: "USER" as "USER" | "LAB_ADMIN" | "HEAD_LAB" },
}));
vi.mock("@/lib/auth", () => ({
  actor: async () => current.user,
  rateLimit: async () => {},
}));
import { GET as document } from "../src/app/api/remote/document/route";
import { GET as list, POST as api } from "../src/app/api/remote/route";
const db = new PrismaClient();
let pcId: string;
let ids: string[];
let bytes: Uint8Array;
let student: { id: string; role: "USER" },
  other: { id: string; role: "USER" },
  admin: { id: string; role: "LAB_ADMIN" };
beforeAll(async () => {
  const p = await PDFDocument.create();
  p.addPage();
  bytes = await p.save();
});
beforeEach(async () => {
  ids = [randomUUID(), randomUUID(), randomUUID()];
  for (let i = 0; i < 3; i++)
    await db.user.create({
      data: {
        id: ids[i],
        name: "Remote test " + i,
        email: ids[i] + "@example.test",
        passwordHash: "not-a-login-hash",
        role: i === 2 ? "LAB_ADMIN" : "USER",
        userType: "STUDENT",
      },
    });
  student = { id: ids[0], role: "USER" };
  other = { id: ids[1], role: "USER" };
  admin = { id: ids[2], role: "LAB_ADMIN" };
  current.user = student;
  const lab = await db.laboratory.findUniqueOrThrow({ where: { code: "AI" } });
  pcId = "remote-test-" + randomUUID();
  await db.pC.create({
    data: {
      id: pcId,
      code: pcId,
      laboratoryId: lab.id,
      name: "Remote test PC",
      cpu: "Test",
      ram: "Test",
      description: "Fixture",
    },
  });
});
afterEach(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.remoteRequest.deleteMany({ where: { pcId } });
  await db.pCBorrowRequest.deleteMany({ where: { pcId } });
  await db.pC.delete({ where: { id: pcId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
});
afterAll(() => db.$disconnect());
const input = () => ({
  pcId,
  startAt: new Date(Date.now() + 86400000),
  endAt: new Date(Date.now() + 5 * 86400000),
  purpose: "Eksperimen model selama beberapa hari",
});
const file = () => ({ name: "surat.pdf", bytes });
it("surat wajib PDF valid sebelum permintaan multi-hari PENDING dibuat", async () => {
  await expect(
    requestRemote(student, input(), {
      name: "surat.pdf",
      bytes: new Uint8Array(),
    }),
  ).rejects.toThrow();
  await expect(
    requestRemote(student, input(), { name: "surat.exe", bytes }),
  ).rejects.toThrow();
  const r = await requestRemote(student, input(), file());
  expect(r.status).toBe("PENDING");
  expect(r.fileName).toBe("surat.pdf");
  expect("fileBytes" in r).toBe(false);
});
it("surat hanya diunduh pemilik atau admin", async () => {
  const r = await requestRemote(student, input(), file());
  const req = () =>
    new Request("http://localhost:3000/api/remote/document?id=" + r.id);
  expect((await document(req())).status).toBe(200);
  current.user = other;
  expect((await document(req())).status).toBe(403);
  current.user = admin;
  const res = await document(req());
  expect(res.headers.get("content-disposition")).toContain("attachment");
  expect((await res.arrayBuffer()).byteLength).toBe(bytes.length);
});
it("daftar mahasiswa hanya berisi pengajuan sendiri tanpa isi dokumen", async () => {
  const own = await requestRemote(student, input(), file());
  await requestRemote(other, input(), file());
  const json = await (await list()).json();
  expect(json.requests.map((r: { id: string }) => r.id)).toEqual([own.id]);
  expect(JSON.stringify(json)).not.toContain("fileBytes");
});
it("admin menyetujui, menyimpan tautan akses dan audit", async () => {
  const r = await requestRemote(student, input(), file());
  const result = await reviewRemote(admin, {
    id: r.id,
    approve: true,
    accessUrl: "https://example.org/panduan-remote",
  });
  expect(result.status).toBe("APPROVED");
  expect(result.accessUrl).toContain("panduan");
  expect(await db.auditLog.count({ where: { entityId: r.id } })).toBe(1);
});
it("penolakan memerlukan alasan; pengguna biasa dan peninjauan sendiri ditolak", async () => {
  const r = await requestRemote(student, input(), file());
  await expect(
    reviewRemote(student, { id: r.id, approve: true }),
  ).rejects.toThrow();
  await expect(
    reviewRemote(admin, { id: r.id, approve: false }),
  ).rejects.toThrow();
  expect(
    (
      await reviewRemote(admin, {
        id: r.id,
        approve: false,
        reason: "Surat belum lengkap",
      })
    ).rejectionReason,
  ).toBe("Surat belum lengkap");
  const own = await requestRemote(admin, input(), file());
  await expect(
    reviewRemote(admin, { id: own.id, approve: true }),
  ).rejects.toThrow("sendiri");
});
it("pembatalan hanya oleh pemilik untuk jadwal yang belum mulai", async () => {
  const r = await requestRemote(student, input(), file());
  await expect(cancelRemote(other, r.id)).rejects.toThrow();
  await cancelRemote(student, r.id);
  expect(
    (await db.remoteRequest.findUniqueOrThrow({ where: { id: r.id } })).status,
  ).toBe("CANCELLED");
});
it("dua persetujuan remote bersamaan menghasilkan satu pemenang", async () => {
  const a = await requestRemote(student, input(), file()),
    b = await requestRemote(other, input(), file());
  const result = await Promise.allSettled([
    reviewRemote(admin, { id: a.id, approve: true }),
    reviewRemote(admin, { id: b.id, approve: true }),
  ]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
});
it("persetujuan peminjaman biasa dan remote bersamaan tidak dapat overlap", async () => {
  const a = await requestRemote(student, input(), file()),
    b = await reserve(other, input());
  const result = await Promise.allSettled([
    reviewRemote(admin, { id: a.id, approve: true }),
    review(admin, b.id, true),
  ]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
});
it("database menolak penulisan langsung peminjaman biasa yang konflik dengan remote", async () => {
  const a = await requestRemote(student, input(), file());
  await reviewRemote(admin, { id: a.id, approve: true });
  const pc = await db.pC.findUniqueOrThrow({ where: { id: pcId } });
  await expect(
    db.pCBorrowRequest.create({
      data: {
        ...input(),
        userId: other.id,
        laboratoryId: pc.laboratoryId,
        status: "APPROVED",
      },
    }),
  ).rejects.toThrow();
  await expect(reserve(other, input())).rejects.toThrow();
});
it("maintenance dan terremote diperiksa kembali saat persetujuan", async () => {
  const r = await requestRemote(student, input(), file());
  await db.pC.update({ where: { id: pcId }, data: { status: "REMOTE" } });
  await expect(
    reviewRemote(admin, { id: r.id, approve: true }),
  ).rejects.toThrow();
  await expect(requestRemote(other, input(), file())).rejects.toThrow();
  await expect(reserve(student, input())).rejects.toThrow();
});
it("kepala lab tidak dapat mengajukan, meninjau, atau mengubah formulir", async () => {
  const head = { id: student.id, role: "HEAD_LAB" as const };
  await expect(requestRemote(head, input(), file())).rejects.toThrow();
  current.user = head;
  const response = await api(
    new Request("http://localhost:3000/api/remote", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "template", url: "https://example.org" }),
    }),
  );
  expect(response.status).toBe(400);
});
