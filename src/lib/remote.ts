import { Role } from "@prisma/client";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { db } from "./db";
import { assertRole, interval } from "./rules";
type Actor = { id: string; role: Role };
export const remoteSelect = {
  id: true,
  userId: true,
  pcId: true,
  startAt: true,
  endAt: true,
  purpose: true,
  status: true,
  reviewerId: true,
  reviewedAt: true,
  rejectionReason: true,
  accessUrl: true,
  fileName: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, identity: true } },
  pc: { select: { id: true, code: true, laboratoryId: true } },
} as const;
const schema = z.object({
  pcId: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  purpose: z.string().trim().min(10).max(2000),
});
export async function requestRemote(
  user: Actor,
  input: unknown,
  file: { name: string; bytes: Uint8Array },
) {
  assertRole(user.role, ["USER", "LAB_ADMIN"]);
  const data = schema.parse(input);
  interval(data.startAt, data.endAt);
  if (
    !file.name.toLowerCase().endsWith(".pdf") ||
    !file.bytes.length ||
    file.bytes.length > 5 * 1024 * 1024 ||
    Buffer.from(file.bytes.subarray(0, 5)).toString() !== "%PDF-"
  )
    throw new Error("Unggah surat PDF yang valid, maksimal 5 MB.");
  try {
    const pdf = await PDFDocument.load(file.bytes);
    if (!pdf.getPageCount()) throw new Error();
  } catch {
    throw new Error("Surat PDF tidak dapat dibaca atau dilindungi kata sandi.");
  }
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${data.pcId} FOR UPDATE`;
    const pc = await tx.pC.findUniqueOrThrow({
      where: { id: data.pcId },
      include: { laboratory: true },
    });
    if (
      pc.laboratory.code !== "AI" ||
      !pc.laboratory.active ||
      ["MAINTENANCE", "UNAVAILABLE", "REMOTE"].includes(pc.status)
    )
      throw new Error("PC tidak tersedia untuk pengajuan remote.");
    const overlap = {
      pcId: pc.id,
      status: "APPROVED" as const,
      startAt: { lt: data.endAt },
      endAt: { gt: data.startAt },
    };
    if (
      (await tx.pCBorrowRequest.count({ where: overlap })) ||
      (await tx.remoteRequest.count({ where: overlap }))
    )
      throw new Error(
        "Jadwal bertabrakan dengan peminjaman atau remote yang disetujui.",
      );
    return tx.remoteRequest.create({
      data: {
        ...data,
        userId: user.id,
        fileName: file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 150),
        fileBytes: Buffer.from(file.bytes),
      },
      select: remoteSelect,
    });
  });
}
export async function reviewRemote(user: Actor, input: unknown) {
  assertRole(user.role, ["LAB_ADMIN"]);
  const d = z
    .object({
      id: z.string(),
      approve: z.boolean(),
      reason: z.string().trim().max(2000).optional(),
      accessUrl: z.string().url().startsWith("https://").optional(),
    })
    .parse(input);
  if (!d.approve && (!d.reason || d.reason.length < 5))
    throw new Error("Alasan penolakan minimal 5 karakter.");
  return db.$transaction(async (tx) => {
    const initial = await tx.remoteRequest.findUniqueOrThrow({
      where: { id: d.id },
    });
    await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${initial.pcId} FOR UPDATE`;
    const r = await tx.remoteRequest.findUniqueOrThrow({
      where: { id: d.id },
      include: { pc: { include: { laboratory: true } } },
    });
    if (r.userId === user.id)
      throw new Error("Tidak dapat meninjau pengajuan sendiri.");
    if (r.status !== "PENDING") throw new Error("Pengajuan sudah diproses.");
    if (d.approve) {
      if (r.endAt <= new Date())
        throw new Error("Jadwal pengajuan telah berakhir.");
      if (
        !r.pc.laboratory.active ||
        r.pc.laboratory.code !== "AI" ||
        ["MAINTENANCE", "UNAVAILABLE", "REMOTE"].includes(r.pc.status)
      )
        throw new Error("PC tidak tersedia.");
      const overlap = {
        pcId: r.pcId,
        status: "APPROVED" as const,
        startAt: { lt: r.endAt },
        endAt: { gt: r.startAt },
      };
      if (
        (await tx.remoteRequest.count({ where: overlap })) ||
        (await tx.pCBorrowRequest.count({ where: overlap }))
      )
        throw new Error(
          "Jadwal bertabrakan dengan peminjaman atau remote yang disetujui.",
        );
      if (
        r.startAt <= new Date() &&
        (await tx.attendanceSession.count({
          where: { pcId: r.pcId, status: "ACTIVE" },
        }))
      )
        throw new Error("PC sedang dipakai di laboratorium.");
    }
    const result = await tx.remoteRequest.update({
      where: { id: r.id },
      data: {
        status: d.approve ? "APPROVED" : "REJECTED",
        reviewerId: user.id,
        reviewedAt: new Date(),
        rejectionReason: d.approve ? null : d.reason,
        accessUrl: d.approve ? d.accessUrl : null,
      },
      select: remoteSelect,
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: d.approve ? "APPROVE_REMOTE" : "REJECT_REMOTE",
        entityId: r.id,
        reason: d.reason,
      },
    });
    return result;
  });
}
export async function cancelRemote(user: Actor, id: string) {
  assertRole(user.role, ["USER", "LAB_ADMIN"]);
  return db.$transaction(async (tx) => {
    const initial = await tx.remoteRequest.findUniqueOrThrow({ where: { id } });
    await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${initial.pcId} FOR UPDATE`;
    const r = await tx.remoteRequest.updateMany({
      where: {
        id,
        userId: user.id,
        status: { in: ["PENDING", "APPROVED"] },
        startAt: { gt: new Date() },
      },
      data: { status: "CANCELLED" },
    });
    if (!r.count) throw new Error("Pengajuan tidak dapat dibatalkan.");
  });
}
