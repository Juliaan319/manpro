import { PrismaClient } from "@prisma/client";
import { ensureAIInventory } from "./inventory";
import { hash } from "bcryptjs";
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seed demo dilarang di produksi.");
  const passwordHash = await hash("LabTrackDemo2026!", 12);
  for (const u of [
    {
      id: "demo-student",
      name: "Andi Pratama",
      email: "c140000001@john.petra.ac.id",
      role: "USER" as const,
      userType: "STUDENT" as const,
      identity: "C140000001",
    },
    {
      id: "demo-admin",
      name: "Maria Santoso",
      email: "admin@labtrack.test",
      role: "LAB_ADMIN" as const,
      userType: "STAFF" as const,
      identity: "NIP-DEMO-001",
    },
    {
      id: "demo-head",
      name: "Budi Wijaya",
      email: "kepala@labtrack.test",
      role: "HEAD_LAB" as const,
      userType: "LECTURER" as const,
      identity: "NIP-DEMO-002",
    },
  ])
    await db.user.upsert({
      where: { id: u.id },
      create: { ...u, passwordHash },
      update: {},
    });
  for (const l of [
    {
      id: "lab-ai",
      code: "AI",
      name: "Laboratorium AI",
      description:
        "Ruang eksplorasi kecerdasan buatan, pembelajaran mesin, dan komputasi GPU.",
      location: "Gedung P · Ruang Laboratorium AI (demo)",
    },
    {
      id: "lab-vr",
      code: "VR",
      name: "Laboratorium VR",
      description:
        "Ruang pengembangan realitas virtual, simulasi interaktif, dan pengalaman imersif.",
      location: "Gedung P · Ruang Laboratorium VR (demo)",
    },
  ])
    await db.laboratory.upsert({ where: { id: l.id }, create: l, update: {} });
  for (const [i, code] of [
    "AI-PC-01",
    "AI-PC-02",
    "AI-PC-03",
    "VR-PC-01",
    "VR-PC-02",
  ].entries())
    await db.pC.upsert({
      where: { code },
      create: {
        id: code.toLowerCase(),
        code,
        laboratoryId: code.startsWith("AI") ? "lab-ai" : "lab-vr",
        name: code.startsWith("AI")
          ? "Stasiun komputasi AI"
          : "Stasiun pengembangan VR",
        description:
          "Spesifikasi contoh pengembangan; verifikasi dengan perangkat fisik.",
        cpu: i < 3 ? "Intel Core i7-13700" : "AMD Ryzen 7 7700",
        ram: "32 GB",
        gpu: i === 2 ? null : i < 3 ? "NVIDIA RTX 4090" : "NVIDIA RTX 4070",
        vram: i === 2 ? null : i < 3 ? 24576 : 12288,
        status: i === 4 ? "MAINTENANCE" : "AVAILABLE",
        monitoring: true,
      },
      update: {},
    });
  await ensureAIInventory(db);
  for (let i = 0; i < 14; i++) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - i - 1);
    start.setUTCHours(2 + (i % 4), 0, 0, 0);
    const end = new Date(+start + (60 + i * 7) * 60000);
    const pc = i % 2 ? "vr-pc-01" : "ai-pc-01";
    const laboratoryId = i % 2 ? "lab-vr" : "lab-ai";
    const r = await db.pCBorrowRequest.upsert({
      where: { id: "seed-request-" + i },
      create: {
        id: "seed-request-" + i,
        userId: "demo-student",
        laboratoryId,
        pcId: pc,
        startAt: start,
        endAt: end,
        purpose:
          "Data demo: praktikum " +
          (i % 2 ? "realitas virtual" : "pembelajaran mesin"),
        status: "COMPLETED",
        reviewerId: "demo-admin",
        reviewedAt: start,
      },
      update: {},
    });
    await db.attendanceSession.upsert({
      where: { id: "seed-attendance-" + i },
      create: {
        id: "seed-attendance-" + i,
        userId: "demo-student",
        laboratoryId,
        pcId: pc,
        reservationId: r.id,
        purpose: r.purpose,
        checkIn: start,
        checkOut: end,
        durationMinutes: 60 + i * 7,
        status: "COMPLETED",
      },
      update: {},
    });
  }
  const start = new Date(Date.now() + 86400000);
  start.setUTCMinutes(0, 0, 0);
  await db.pCBorrowRequest.upsert({
    where: { id: "seed-pending" },
    create: {
      id: "seed-pending",
      userId: "demo-student",
      laboratoryId: "lab-ai",
      pcId: "ai-pc-02",
      startAt: start,
      endAt: new Date(+start + 7200000),
      purpose: "Data demo: eksperimen model klasifikasi gambar",
      status: "PENDING",
    },
    update: {},
  });
  console.log("Seed selesai: 3 pengguna, 2 laboratorium, 12 PC, riwayat demo.");
}
main().finally(() => db.$disconnect());
