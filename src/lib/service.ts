import { db } from "./db";
import { Role, Prisma } from "@prisma/client";
import { assertRole, interval, duration, attendanceDay } from "./rules";
import { verifyQRTarget } from "./qr";
import { z } from "zod";
type Actor = { id: string; role: Role };
export const requestSchema = z.object({
  pcId: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  purpose: z.string().min(5).max(1000),
});
export async function reserve(user: Actor, input: unknown) {
  assertRole(user.role, ["USER", "LAB_ADMIN"]);
  const data = requestSchema.parse(input);
  interval(data.startAt, data.endAt);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${data.pcId} FOR UPDATE`;
    const pc = await tx.pC.findUniqueOrThrow({
      where: { id: data.pcId },
      include: { laboratory: true },
    });
    if (pc.laboratory.code === "VR")
      throw new Error("PC Laboratorium VR tidak tersedia untuk peminjaman PC.");
    if (
      !pc.laboratory.active ||
      ["MAINTENANCE", "UNAVAILABLE", "REMOTE"].includes(pc.status)
    )
      throw new Error("PC atau laboratorium tidak tersedia.");
    if (
      await tx.pCBorrowRequest.count({
        where: {
          pcId: pc.id,
          status: "APPROVED",
          startAt: { lt: data.endAt },
          endAt: { gt: data.startAt },
        },
      })
    )
      throw new Error("Jadwal bertabrakan dengan reservasi disetujui.");
    if (
      await tx.remoteRequest.count({
        where: {
          pcId: pc.id,
          status: "APPROVED",
          startAt: { lt: data.endAt },
          endAt: { gt: data.startAt },
        },
      })
    )
      throw new Error("PC sudah dipesan untuk remote pada jadwal tersebut.");
    return tx.pCBorrowRequest.create({
      data: { ...data, userId: user.id, laboratoryId: pc.laboratoryId },
    });
  });
}
export async function review(
  user: Actor,
  id: string,
  approve: boolean,
  reason?: string,
) {
  assertRole(user.role, ["LAB_ADMIN"]);
  if (!approve && (!reason || reason.trim().length < 5))
    throw new Error("Alasan penolakan minimal 5 karakter.");
  return db.$transaction(async (tx) => {
    const initial = await tx.pCBorrowRequest.findUniqueOrThrow({
      where: { id },
    });
    await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${initial.pcId} FOR UPDATE`;
    const request = await tx.pCBorrowRequest.findUniqueOrThrow({
      where: { id },
      include: { pc: { include: { laboratory: true } } },
    });
    if (request.userId === user.id)
      throw new Error("Tidak dapat meninjau pengajuan sendiri.");
    if (request.status !== "PENDING")
      throw new Error("Pengajuan sudah diproses.");
    if (approve) {
      if (request.pc.laboratory.code === "VR")
        throw new Error(
          "PC Laboratorium VR tidak tersedia untuk peminjaman PC.",
        );
      if (
        await tx.remoteRequest.count({
          where: {
            pcId: request.pcId,
            status: "APPROVED",
            startAt: { lt: request.endAt },
            endAt: { gt: request.startAt },
          },
        })
      )
        throw new Error("Jadwal bertabrakan dengan remote yang disetujui.");
      if (request.endAt <= new Date())
        throw new Error("Pengajuan telah kedaluwarsa.");
      if (
        !request.pc.laboratory.active ||
        ["MAINTENANCE", "UNAVAILABLE", "REMOTE"].includes(request.pc.status)
      )
        throw new Error("PC tidak tersedia.");
      if (
        await tx.pCBorrowRequest.count({
          where: {
            pcId: request.pcId,
            status: "APPROVED",
            startAt: { lt: request.endAt },
            endAt: { gt: request.startAt },
          },
        })
      )
        throw new Error("Jadwal bertabrakan.");
    }
    const result = await tx.pCBorrowRequest.update({
      where: { id },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        reviewerId: user.id,
        reviewedAt: new Date(),
        rejectionReason: approve ? null : reason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: approve ? "APPROVE" : "REJECT",
        entityId: id,
        reason,
      },
    });
    return result;
  });
}
export async function cancel(user: Actor, id: string) {
  assertRole(user.role, ["USER", "LAB_ADMIN"]);
  return db.$transaction(async (tx) => {
    const initial = await tx.pCBorrowRequest.findUniqueOrThrow({
      where: { id },
    });
    await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${initial.pcId} FOR UPDATE`;
    const result = await tx.pCBorrowRequest.updateMany({
      where: {
        id,
        userId: user.id,
        status: { in: ["PENDING", "APPROVED"] },
        startAt: { gt: new Date() },
        attendance: { is: null },
      },
      data: { status: "CANCELLED" },
    });
    if (!result.count) throw new Error("Pengajuan ini tidak dapat dibatalkan.");
  });
}
export async function checkin(
  user: Actor,
  input: {
    laboratoryId: string;
    purpose: string;
    reservationId?: string;
    qr?: string;
    targetUserId?: string;
  },
) {
  assertRole(user.role, ["USER", "LAB_ADMIN"]);
  const data = z
    .object({
      laboratoryId: z.string().min(1),
      purpose: z.string().min(5).max(1000),
      reservationId: z.string().optional(),
      qr: z.string().optional(),
      targetUserId: z.string().optional(),
    })
    .parse(input);
  if (data.targetUserId) assertRole(user.role, ["LAB_ADMIN"]);
  if (user.role === "USER" && !data.qr)
    throw new Error("Mahasiswa wajib memindai QR laboratorium untuk presensi.");
  const userId = data.targetUserId || user.id;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    const now = new Date();
    const day = attendanceDay(now);
    const lab = await tx.laboratory.findUniqueOrThrow({
      where: { id: data.laboratoryId },
    });
    const qrTarget = data.qr ? verifyQRTarget(data.qr) : undefined;
    if (qrTarget?.kind === "lab" && qrTarget.laboratoryId !== lab.id)
      throw new Error("QR tidak sesuai laboratorium.");
    if (
      qrTarget?.kind === "lab" &&
      qrTarget.version !== undefined &&
      qrTarget.version !== lab.qrVersion
    )
      throw new Error(
        "QR laboratorium sudah diganti. Pindai QR terbaru di laboratorium.",
      );
    const qrPC = qrTarget?.kind === "pc" ? qrTarget.pcId : undefined;
    if (qrPC) {
      const scanned = await tx.pC.findUniqueOrThrow({ where: { id: qrPC } });
      if (scanned.laboratoryId !== lab.id)
        throw new Error("QR tidak sesuai laboratorium.");
    }
    const daily = await tx.attendanceSession.findFirst({
      where: {
        userId,
        laboratoryId: lab.id,
        OR: [
          { attendanceDay: day.key },
          { checkIn: { gte: day.start, lt: day.end } },
        ],
      },
      orderBy: { checkIn: "asc" },
    });
    if (daily) {
      if (!data.qr)
        throw new Error(
          "Presensi hari ini sudah tercatat. Gunakan QR untuk mencatat atau memperbarui waktu keluar.",
        );
      if (daily.status === "CORRECTED")
        throw new Error(
          "Sesi ini sudah dikoreksi pengelola. Hubungi administrator.",
        );
      if (qrPC && daily.pcId && daily.pcId !== qrPC)
        throw new Error("Gunakan QR PC yang terhubung dengan presensi Anda.");
      await tx.$queryRaw`SELECT id FROM "AttendanceSession" WHERE id=${daily.id} FOR UPDATE`;
      const latest = await tx.attendanceSession.findUniqueOrThrow({
        where: { id: daily.id },
      });
      if (latest.status === "CORRECTED")
        throw new Error("Sesi ini sudah dikoreksi pengelola.");
      const end = new Date(
        Math.max(now.getTime(), latest.checkOut?.getTime() || 0),
      );
      const result = await tx.attendanceSession.update({
        where: { id: latest.id },
        data: {
          status: "COMPLETED",
          checkOut: end,
          durationMinutes: duration(latest.checkIn, end),
          attendanceDay: day.key,
        },
      });
      if (latest.reservationId)
        await tx.pCBorrowRequest.update({
          where: { id: latest.reservationId },
          data: { status: "COMPLETED" },
        });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action:
            latest.status === "ACTIVE" ? "QR_CHECKOUT" : "QR_REFRESH_CHECKOUT",
          entityId: latest.id,
          reason: "Scan QR; satu sesi per hari WIB per laboratorium.",
        },
      });
      return result;
    }
    if (
      await tx.attendanceSession.count({ where: { userId, status: "ACTIVE" } })
    )
      throw new Error("Masih ada presensi aktif.");
    if (!lab.active) throw new Error("Laboratorium tidak aktif.");
    let pcId: string | undefined;
    if (data.qr) pcId = qrPC;
    if (data.reservationId) {
      const initial = await tx.pCBorrowRequest.findUniqueOrThrow({
        where: { id: data.reservationId },
      });
      await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${initial.pcId} FOR UPDATE`;
      const r = await tx.pCBorrowRequest.findUniqueOrThrow({
        where: { id: data.reservationId },
      });
      if (
        r.userId !== userId ||
        r.status !== "APPROVED" ||
        r.laboratoryId !== lab.id ||
        r.startAt > now ||
        r.endAt <= now
      )
        throw new Error(
          "Reservasi tidak sesuai pengguna, laboratorium, atau waktu.",
        );
      if (pcId && pcId !== r.pcId) throw new Error("PC pada QR berbeda.");
      pcId = r.pcId;
    }
    if (pcId) {
      await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${pcId} FOR UPDATE`;
      const pc = await tx.pC.findUniqueOrThrow({ where: { id: pcId } });
      if (
        pc.laboratoryId !== lab.id ||
        ["MAINTENANCE", "UNAVAILABLE", "REMOTE"].includes(pc.status)
      )
        throw new Error("PC tidak tersedia.");
      if (
        await tx.attendanceSession.count({ where: { pcId, status: "ACTIVE" } })
      )
        throw new Error("PC sedang digunakan.");
      if (
        await tx.remoteRequest.count({
          where: {
            pcId,
            status: "APPROVED",
            startAt: { lte: now },
            endAt: { gt: now },
          },
        })
      )
        throw new Error("PC sedang digunakan untuk remote.");
      const occupying = await tx.pCBorrowRequest.findFirst({
        where: {
          pcId,
          status: "APPROVED",
          startAt: { lte: now },
          endAt: { gt: now },
        },
      });
      if (occupying && occupying.id !== data.reservationId)
        throw new Error("Pilih reservasi aktif Anda sebelum memindai QR.");
    }
    const result = await tx.attendanceSession.create({
      data: {
        userId,
        attendanceDay: day.key,
        laboratoryId: lab.id,
        pcId,
        reservationId: data.reservationId || null,
        purpose: data.purpose,
      },
    });
    if (data.targetUserId)
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ASSIST_CHECKIN",
          entityId: result.id,
          reason: data.purpose,
        },
      });
    return result;
  });
}
export async function checkout(
  user: Actor,
  id: string,
  correctionReason?: string,
) {
  assertRole(user.role, ["USER", "LAB_ADMIN"]);
  if (user.role === "USER")
    throw new Error("Pindai kembali QR laboratorium untuk mencatat keluar.");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AttendanceSession" WHERE id=${id} FOR UPDATE`;
    const s = await tx.attendanceSession.findUniqueOrThrow({ where: { id } });
    if (s.status !== "ACTIVE") throw new Error("Sesi sudah ditutup.");
    if (correctionReason) {
      assertRole(user.role, ["LAB_ADMIN"]);
      if (correctionReason.trim().length < 10)
        throw new Error("Alasan koreksi minimal 10 karakter.");
    } else if (s.userId !== user.id) throw new Error("Tidak memiliki izin.");
    const now = new Date();
    const result = await tx.attendanceSession.update({
      where: { id },
      data: correctionReason
        ? {
            status: "CORRECTED",
            correctionReason,
            checkOut: null,
            durationMinutes: null,
          }
        : {
            status: "COMPLETED",
            checkOut: now,
            durationMinutes: duration(s.checkIn, now),
          },
    });
    if (s.reservationId)
      await tx.pCBorrowRequest.update({
        where: { id: s.reservationId },
        data: { status: "COMPLETED" },
      });
    if (correctionReason)
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "CORRECT_ATTENDANCE_UNKNOWN_END",
          entityId: id,
          reason: correctionReason,
        },
      });
    return result;
  });
}
export function reportWhere(
  params: URLSearchParams,
): Prisma.AttendanceSessionWhereInput {
  const from = params.get("from"),
    to = params.get("to");
  const q = params.get("q")?.trim();
  return {
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { pc: { code: { contains: q, mode: "insensitive" as const } } },
            { purpose: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    laboratoryId: params.get("lab") || undefined,
    pcId: params.get("pc") || undefined,
    user: params.get("type")
      ? {
          userType: z
            .enum(["STUDENT", "LECTURER", "STAFF", "EXTERNAL"])
            .parse(params.get("type")),
        }
      : undefined,
    reservation: params.get("status")
      ? {
          status: z
            .enum([
              "PENDING",
              "APPROVED",
              "REJECTED",
              "CANCELLED",
              "COMPLETED",
              "EXPIRED",
            ])
            .parse(params.get("status")),
        }
      : undefined,
    checkIn: {
      gte: from ? new Date(from + "T00:00:00+07:00") : undefined,
      lte: to ? new Date(to + "T23:59:59.999+07:00") : undefined,
    },
  };
}
