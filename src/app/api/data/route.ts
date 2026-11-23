import { NextResponse } from "next/server";
import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { connectivity } from "@/lib/rules";
export async function GET() {
  try {
    const u = await actor();
    const privileged = u.role !== "USER";
    await db.pCBorrowRequest.updateMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        endAt: { lt: new Date() },
        attendance: { is: null },
      },
      data: { status: "EXPIRED" },
    });
    const [labs, pcs, requests, attendance, users, audits] = await Promise.all([
      db.laboratory.findMany({ orderBy: { code: "asc" } }),
      db.pC.findMany({
        include: {
          laboratory: true,
          telemetry: privileged
            ? { orderBy: { recordedAt: "desc" }, take: 1 }
            : false,
        },
        orderBy: { code: "asc" },
      }),
      db.pCBorrowRequest.findMany({
        where: privileged ? {} : { userId: u.id },
        include: {
          pc: true,
          user: { select: { id: true, name: true, userType: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.attendanceSession.findMany({
        where: privileged ? {} : { userId: u.id },
        include: {
          pc: true,
          laboratory: true,
          user: { select: { id: true, name: true, userType: true } },
        },
        orderBy: { checkIn: "desc" },
      }),
      privileged
        ? db.user.findMany({
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              userType: true,
            },
          })
        : [],
      u.role === "LAB_ADMIN"
        ? db.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { actor: { select: { name: true } } },
          })
        : [],
    ]);
    const now = new Date();
    const occupancy = await db.pCBorrowRequest.findMany({
      where: { status: "APPROVED", endAt: { gt: now } },
      select: { id: true, pcId: true, startAt: true, endAt: true },
    });
    const active = await db.attendanceSession.findMany({
      where: { status: "ACTIVE" },
      select: { pcId: true },
    });
    const remoteSlots = await db.remoteRequest.findMany({
      where: { status: "APPROVED", endAt: { gt: now } },
      select: { id: true, pcId: true, startAt: true, endAt: true },
    });
    const remoteActive = await db.remoteRequest.findMany({
      where: { status: "APPROVED", startAt: { lte: now }, endAt: { gt: now } },
      select: { pcId: true },
    });
    return NextResponse.json({
      serverTime: new Date().toISOString(),
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        userType: u.userType,
        identity: u.identity,
        institution: u.institution,
      },
      labs,
      pcs: pcs.map((p) => ({
        ...p,
        connectivity: connectivity(p.lastHeartbeat),
        effectiveStatus: ["MAINTENANCE", "UNAVAILABLE", "REMOTE"].includes(
          p.status,
        )
          ? p.status
          : remoteActive.some((r) => r.pcId === p.id)
            ? "REMOTE"
            : active.some((s) => s.pcId === p.id)
              ? "IN_USE"
              : occupancy.some((r) => r.pcId === p.id && r.startAt <= now)
                ? "RESERVED"
                : p.status,
      })),
      requests,
      attendance,
      users,
      audits,
      occupancy: [...occupancy, ...remoteSlots],
    });
  } catch {
    return NextResponse.json(
      { error: "Silakan masuk terlebih dahulu." },
      { status: 401 },
    );
  }
}
