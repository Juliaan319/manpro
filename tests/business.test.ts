import {
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID, createHash } from "crypto";
import { db } from "../src/lib/db";
import {
  reserve,
  review,
  cancel,
  checkin,
  checkout,
  reportWhere,
} from "../src/lib/service";
import { duration, connectivity, assertRole, overlaps } from "../src/lib/rules";
import {
  signQR,
  verifyQR,
  signLabQR,
  signPrintedLabQR,
  verifyQRTarget,
} from "../src/lib/qr";
const state = vi.hoisted(() => ({
  user: { id: "", role: "LAB_ADMIN" as "LAB_ADMIN" | "USER" | "HEAD_LAB" },
}));
vi.mock("@/lib/auth", () => ({
  actor: async () => state.user,
  rateLimit: async () => {},
}));
import { POST as telemetry } from "../src/app/api/telemetry/route";
import { GET as reports } from "../src/app/api/reports/route";
import { POST as registration } from "../src/app/api/register/route";
import { POST as action } from "../src/app/api/action/route";
let labId: string, pcId: string;
let student: { id: string; role: "USER" },
  admin: { id: string; role: "LAB_ADMIN" },
  other: { id: string; role: "USER" },
  head: { id: string; role: "HEAD_LAB" };
let ids: string[] = [];
function input(offset = 3600000) {
  return {
    pcId,
    startAt: new Date(Date.now() + offset),
    endAt: new Date(Date.now() + offset + 3600000),
    purpose: "Eksperimen pengujian laboratorium",
  };
}
beforeEach(async () => {
  const key = randomUUID();
  labId = "test-lab-" + key;
  pcId = "test-pc-" + key;
  ids = [];
  for (const role of ["USER", "LAB_ADMIN", "USER", "HEAD_LAB"] as const) {
    const id = randomUUID();
    ids.push(id);
    await db.user.create({
      data: {
        id,
        name: "Pengguna uji " + ids.length,
        email: id + "@example.test",
        passwordHash: "not-a-login-hash",
        userType: "STUDENT",
        role,
      },
    });
  }
  student = { id: ids[0], role: "USER" };
  admin = { id: ids[1], role: "LAB_ADMIN" };
  other = { id: ids[2], role: "USER" };
  head = { id: ids[3], role: "HEAD_LAB" };
  state.user = admin;
  await db.laboratory.create({
    data: {
      id: labId,
      code: labId,
      name: "Laboratorium Uji",
      description: "Pengujian",
      location: "Lokasi uji",
    },
  });
  await db.pC.create({
    data: {
      id: pcId,
      code: pcId,
      name: "PC Uji",
      laboratoryId: labId,
      description: "Uji",
      cpu: "CPU uji",
      ram: "32 GB",
    },
  });
});
afterEach(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.attendanceSession.deleteMany({ where: { laboratoryId: labId } });
  await db.pCBorrowRequest.deleteMany({ where: { laboratoryId: labId } });
  await db.pCTelemetry.deleteMany({ where: { pcId } });
  await db.deviceCredential.deleteMany({ where: { pcId } });
  await db.pC.deleteMany({ where: { laboratoryId: labId } });
  await db.laboratory.delete({ where: { id: labId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
});
afterAll(() => db.$disconnect());
describe("Reservasi PostgreSQL", () => {
  it("mahasiswa mengajukan permintaan awal PENDING", async () => {
    const r = await reserve(student, input());
    expect(r.status).toBe("PENDING");
    expect(r.userId).toBe(student.id);
  });
  it("administrator menyetujui dan mencatat audit", async () => {
    const r = await reserve(student, input());
    expect((await review(admin, r.id, true)).status).toBe("APPROVED");
    expect(await db.auditLog.count({ where: { entityId: r.id } })).toBe(1);
  });
  it("penolakan memerlukan alasan dan menyimpan alasan", async () => {
    const r = await reserve(student, input());
    await expect(review(admin, r.id, false)).rejects.toThrow();
    expect(
      (await review(admin, r.id, false, "Jadwal praktikum terjadwal"))
        .rejectionReason,
    ).toContain("praktikum");
  });
  it("permintaan pending tidak memblokir pending lain", async () => {
    const a = await reserve(student, input());
    const b = await reserve(other, input());
    expect(a.status).toBe("PENDING");
    expect(b.status).toBe("PENDING");
  });
  it("dua persetujuan bersamaan hanya menghasilkan satu reservasi", async () => {
    const a = await reserve(student, input()),
      b = await reserve(other, input());
    const results = await Promise.allSettled([
      review(admin, a.id, true),
      review(admin, b.id, true),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.pCBorrowRequest.count({ where: { pcId, status: "APPROVED" } }),
    ).toBe(1);
  });
  it("constraint database menolak overlap bahkan melalui penulisan langsung", async () => {
    const a = await reserve(student, input());
    await review(admin, a.id, true);
    await expect(
      db.pCBorrowRequest.create({
        data: {
          ...input(),
          userId: other.id,
          laboratoryId: labId,
          status: "APPROVED",
        },
      }),
    ).rejects.toThrow();
  });
  it("jadwal bersebelahan tanpa overlap diperbolehkan", async () => {
    const a = await reserve(student, input());
    await review(admin, a.id, true);
    const b = await reserve(other, {
      ...input(),
      startAt: a.endAt,
      endAt: new Date(+a.endAt + 3600000),
    });
    expect((await review(admin, b.id, true)).status).toBe("APPROVED");
  });
  it("PC pemeliharaan tidak dapat dipesan", async () => {
    await db.pC.update({
      where: { id: pcId },
      data: { status: "MAINTENANCE" },
    });
    await expect(reserve(student, input())).rejects.toThrow("tidak tersedia");
  });
  it("memvalidasi kembali pemeliharaan saat persetujuan", async () => {
    const r = await reserve(student, input());
    await db.pC.update({
      where: { id: pcId },
      data: { status: "MAINTENANCE" },
    });
    await expect(review(admin, r.id, true)).rejects.toThrow();
  });
  it("pengguna membatalkan pengajuan sendiri yang memenuhi syarat", async () => {
    const r = await reserve(student, input());
    await cancel(student, r.id);
    expect(
      (await db.pCBorrowRequest.findUniqueOrThrow({ where: { id: r.id } }))
        .status,
    ).toBe("CANCELLED");
  });
  it("pengguna tidak dapat membatalkan milik pengguna lain", async () => {
    const r = await reserve(student, input());
    await expect(cancel(other, r.id)).rejects.toThrow();
  });
  it("pengguna dan kepala lab tidak bisa menyetujui", async () => {
    const r = await reserve(student, input());
    await expect(review(student, r.id, true)).rejects.toThrow();
    await expect(review(head, r.id, true)).rejects.toThrow();
  });
  it("admin tidak dapat menyetujui pengajuan sendiri", async () => {
    const r = await reserve(admin, input());
    await expect(review(admin, r.id, true)).rejects.toThrow("sendiri");
  });
  it("pengajuan selesai tidak dapat disetujui kembali", async () => {
    const r = await reserve(student, input());
    await db.pCBorrowRequest.update({
      where: { id: r.id },
      data: { status: "COMPLETED" },
    });
    await expect(review(admin, r.id, true)).rejects.toThrow("diproses");
  });
  it("menolak waktu lampau dan interval terbalik", async () => {
    await expect(reserve(student, input(-7200000))).rejects.toThrow();
    const d = input();
    await expect(
      reserve(student, { ...d, endAt: d.startAt }),
    ).rejects.toThrow();
  });
});
describe("Presensi dan QR", () => {
  async function liveReservation() {
    const r = await reserve(student, input());
    await review(admin, r.id, true);
    await db.pCBorrowRequest.update({
      where: { id: r.id },
      data: {
        startAt: new Date(Date.now() - 1000),
        endAt: new Date(Date.now() + 3600000),
      },
    });
    return r;
  }
  it("reservasi disetujui terhubung dengan check-in dan checkout menghitung durasi", async () => {
    const r = await liveReservation();
    const s = await checkin(student, {
      laboratoryId: labId,
      qr: signLabQR(labId),
      purpose: "Menggunakan reservasi",
      reservationId: r.id,
    });
    expect(s.pcId).toBe(pcId);
    await db.attendanceSession.update({
      where: { id: s.id },
      data: { checkIn: new Date(Date.now() - 65 * 60000) },
    });
    const end = await checkin(student, {
      laboratoryId: labId,
      purpose: "Keluar melalui QR lab",
      qr: signLabQR(labId),
    });
    expect(end.durationMinutes).toBe(65);
    expect(
      (await db.pCBorrowRequest.findUniqueOrThrow({ where: { id: r.id } }))
        .status,
    ).toBe("COMPLETED");
  });
  it("kunjungan tanpa reservasi melalui QR; presensi manual mahasiswa ditolak", async () => {
    await checkin(student, {
      laboratoryId: labId,
      qr: signLabQR(labId),
      purpose: "Diskusi penelitian",
    });
    await expect(
      checkin(student, { laboratoryId: labId, purpose: "Kunjungan ganda" }),
    ).rejects.toThrow("QR");
  });
  it("bantuan check-in admin bersamaan tidak menciptakan dua sesi aktif", async () => {
    const outcomes = await Promise.allSettled([
      checkin(admin, {
        laboratoryId: labId,
        targetUserId: student.id,
        purpose: "Kunjungan satu",
      }),
      checkin(admin, {
        laboratoryId: labId,
        targetUserId: student.id,
        purpose: "Kunjungan dua",
      }),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
  });
  it("reservasi orang lain tidak dapat digunakan", async () => {
    const r = await liveReservation();
    await expect(
      checkin(other, {
        laboratoryId: labId,
        qr: signLabQR(labId),
        purpose: "Menggunakan reservasi",
        reservationId: r.id,
      }),
    ).rejects.toThrow();
  });
  it("QR terikat PC dan tanda tangan dimodifikasi ditolak", async () => {
    const token = signQR(pcId);
    expect(verifyQR(token)).toBe(pcId);
    await expect(
      checkin(student, {
        laboratoryId: labId,
        purpose: "Memindai kode QR",
        qr: token + "x",
      }),
    ).rejects.toThrow();
    const s = await checkin(student, {
      laboratoryId: labId,
      purpose: "Memindai kode QR",
      qr: token,
    });
    expect(s.pcId).toBe(pcId);
  });
  it("QR kedaluwarsa ditolak", () => {
    vi.useFakeTimers();
    const token = signQR(pcId);
    vi.advanceTimersByTime(121000);
    expect(() => verifyQR(token)).toThrow("kedaluwarsa");
    vi.useRealTimers();
  });
  it("koreksi lupa checkout tidak mengarang waktu atau durasi", async () => {
    const s = await checkin(student, {
      laboratoryId: labId,
      qr: signLabQR(labId),
      purpose: "Kegiatan penelitian",
    });
    const result = await checkout(
      admin,
      s.id,
      "Pengguna lupa keluar; waktu akhir tidak diketahui.",
    );
    expect(result.status).toBe("CORRECTED");
    expect(result.checkOut).toBeNull();
    expect(result.durationMinutes).toBeNull();
    expect(await db.auditLog.count({ where: { entityId: s.id } })).toBe(1);
  });
  it("checkout pengguna lain dan bantuan non-admin ditolak", async () => {
    const s = await checkin(student, {
      laboratoryId: labId,
      qr: signLabQR(labId),
      purpose: "Kegiatan penelitian",
    });
    await expect(checkout(other, s.id)).rejects.toThrow();
    await expect(
      checkin(other, {
        laboratoryId: labId,
        purpose: "Bantuan pengguna",
        targetUserId: admin.id,
      }),
    ).rejects.toThrow();
  });
  it("kepala lab hanya membaca", async () => {
    await expect(reserve(head, input())).rejects.toThrow();
    await expect(
      checkin(head, { laboratoryId: labId, purpose: "Aktivitas uji" }),
    ).rejects.toThrow();
  });
});
describe("Monitoring, laporan, dan otorisasi API", () => {
  it("heartbeat usang offline dan durasi server konsisten", () => {
    expect(connectivity(new Date(Date.now() - 61000))).toBe("OFFLINE");
    expect(connectivity(null)).toBe("OFFLINE");
    expect(connectivity(new Date())).toBe("ONLINE");
    expect(duration(new Date(0), new Date(125000))).toBe(2);
    expect(() => assertRole("USER", ["LAB_ADMIN"])).toThrow();
    expect(
      overlaps(new Date(0), new Date(10), new Date(10), new Date(20)),
    ).toBe(false);
  });
  it("telemetri tanpa GPU diterima dengan autentikasi per perangkat", async () => {
    const secret = "test-device-secret";
    await db.deviceCredential.create({
      data: {
        pcId,
        secretHash: createHash("sha256").update(secret).digest("hex"),
        simulated: true,
      },
    });
    const make = (token: string, simulated = true) =>
      new Request("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: {
          authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pcId,
          simulated,
          cpuPercent: 30,
          ramPercent: 40,
          gpuName: null,
          gpuPercent: null,
        }),
      });
    expect((await telemetry(make("wrong"))).status).toBe(401);
    expect((await telemetry(make(secret, false))).status).toBe(400);
    expect((await telemetry(make(secret))).status).toBe(200);
    const t = await db.pCTelemetry.findFirstOrThrow({ where: { pcId } });
    expect(t.gpuPercent).toBeNull();
    expect(t.simulated).toBe(true);
  });
  it("laporan memuat hanya data sesuai laboratorium dan jenis pengguna", async () => {
    await checkin(student, {
      laboratoryId: labId,
      qr: signLabQR(labId),
      purpose: "Laporan terfilter",
    });
    const rows = await db.attendanceSession.findMany({
      where: reportWhere(new URLSearchParams({ lab: labId, type: "STUDENT" })),
    });
    expect(rows).toHaveLength(1);
    const response = await reports(
      new Request("http://localhost:3000/api/reports?format=csv&lab=" + labId),
    );
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("Pengguna uji 1");
    expect(csv).not.toContain("Andi Pratama");
    const pdf = await reports(
      new Request("http://localhost:3000/api/reports?format=pdf&lab=" + labId),
    );
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(500);
  });
  it("ekspor admin dan tindakan manajemen ditolak bagi pengguna biasa", async () => {
    state.user = student;
    expect(
      (await reports(new Request("http://localhost:3000/api/reports"))).status,
    ).toBe(403);
    const r = await action(
      new Request("http://localhost:3000/api/action", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "deletePC", id: pcId }),
      }),
    );
    expect(r.status).toBe(400);
    expect(await db.pC.findUnique({ where: { id: pcId } })).not.toBeNull();
  });
  it("tindakan lintas origin ditolak", async () => {
    expect(
      (
        await action(
          new Request("http://localhost:3000/api/action", {
            method: "POST",
            headers: { origin: "https://attacker.test" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
  });
});

it("pendaftaran umum ditutup meskipun email valid atau role dikirim klien", async () => {
  const email = "c14" + Date.now() + "@john.petra.ac.id";
  const response = await registration(
    new Request("http://localhost:3000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Akun Tidak Dibuat",
        email,
        password: "RegistrationTest2026!",
        userType: "STUDENT",
        role: "HEAD_LAB",
      }),
    }),
  );
  expect(response.status).toBe(403);
  expect(await db.user.count({ where: { email } })).toBe(0);
});
it.each([
  "c15260001@john.petra.ac.id",
  "c14abcd@john.petra.ac.id",
  "c14260001@gmail.com",
  "c14260001@john.petra.ac.id.evil.com",
])("registrasi menolak email di luar kebijakan %s", async (email) => {
  const response = await registration(
    new Request("http://localhost:3000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Akun Ditolak",
        email,
        password: "RegistrationTest2026!",
        confirmPassword: "RegistrationTest2026!",
        userType: "STUDENT",
      }),
    }),
  );
  expect(response.status).toBe(403);
  expect(await db.user.count({ where: { email } })).toBe(0);
});

it("scan harian menyimpan masuk pertama dan keluar terakhir tanpa sesi ganda", async () => {
  const token = signQR(pcId);
  const data = {
    laboratoryId: labId,
    purpose: "Pengujian scan harian",
    qr: token,
  };
  const first = await checkin(student, data);
  expect(first.status).toBe("ACTIVE");
  const firstTime = first.checkIn;
  await db.attendanceSession.update({
    where: { id: first.id },
    data: { checkIn: new Date(Date.now() - 30 * 60000) },
  });
  const stored = await db.attendanceSession.findUniqueOrThrow({
    where: { id: first.id },
  });
  const second = await checkin(student, data);
  expect(second.id).toBe(first.id);
  expect(second.status).toBe("COMPLETED");
  expect(second.durationMinutes).toBe(30);
  const third = await checkin(student, data);
  expect(third.checkIn).toEqual(stored.checkIn);
  expect(+third.checkOut!).toBeGreaterThanOrEqual(+second.checkOut!);
  expect(
    await db.attendanceSession.count({
      where: { userId: student.id, laboratoryId: labId },
    }),
  ).toBe(1);
  expect(firstTime).toBeInstanceOf(Date);
});
it("scan bersamaan tetap memakai satu baris presensi harian", async () => {
  const data = {
    laboratoryId: labId,
    purpose: "Pengujian scan bersamaan",
    qr: signQR(pcId),
  };
  const rows = await Promise.all([
    checkin(student, data),
    checkin(student, data),
    checkin(student, data),
  ]);
  expect(new Set(rows.map((r) => r.id)).size).toBe(1);
  expect(
    await db.attendanceSession.count({ where: { userId: student.id } }),
  ).toBe(1);
});
it("scan pada laboratorium berbeda tidak mengubah sesi sebelumnya", async () => {
  const first = await checkin(student, {
    laboratoryId: labId,
    purpose: "Sesi harian mahasiswa",
    qr: signQR(pcId),
  });
  await expect(
    checkin(other, {
      laboratoryId: labId,
      purpose: "Pengguna berbeda",
      qr: signQR(pcId),
    }),
  ).rejects.toThrow();
  expect(
    (await db.attendanceSession.findUniqueOrThrow({ where: { id: first.id } }))
      .checkOut,
  ).toBeNull();
});
it("tanggal presensi berganti tepat tengah malam WIB", async () => {
  const { attendanceDay } = await import("../src/lib/rules");
  expect(attendanceDay(new Date("2026-11-16T16:59:59Z")).key).toBe(
    "2026-11-16",
  );
  expect(attendanceDay(new Date("2026-11-16T17:00:00Z")).key).toBe(
    "2026-11-17",
  );
});
it("hari baru membuat sesi baru tanpa menimpa hari sebelumnya", async () => {
  const { attendanceDay } = await import("../src/lib/rules");
  const data = {
    laboratoryId: labId,
    purpose: "Pengujian pergantian hari",
    qr: signQR(pcId),
  };
  const first = await checkin(student, data);
  await checkin(student, data);
  const yesterday = attendanceDay(new Date(Date.now() - 86400000));
  await db.attendanceSession.update({
    where: { id: first.id },
    data: {
      attendanceDay: yesterday.key,
      checkIn: new Date(Date.now() - 86400000),
      checkOut: new Date(Date.now() - 86340000),
    },
  });
  const next = await checkin(student, data);
  expect(next.id).not.toBe(first.id);
  expect(next.status).toBe("ACTIVE");
  expect(
    await db.attendanceSession.count({ where: { userId: student.id } }),
  ).toBe(2);
});
it("PC VR ditolak saat pengajuan dan peninjauan persetujuan", async () => {
  const vr = await db.pC.findFirstOrThrow({
    where: { laboratory: { code: "VR" } },
  });
  await expect(reserve(student, { ...input(), pcId: vr.id })).rejects.toThrow(
    "VR",
  );
  const r = await db.pCBorrowRequest.create({
    data: {
      ...input(),
      pcId: vr.id,
      laboratoryId: vr.laboratoryId,
      userId: student.id,
    },
  });
  try {
    await expect(review(admin, r.id, true)).rejects.toThrow("VR");
  } finally {
    await db.pCBorrowRequest.delete({ where: { id: r.id } });
  }
});

it("QR laboratorium membuat sesi tanpa wajib PC lalu memperbarui keluar harian", async () => {
  const token = signLabQR(labId);
  expect(verifyQRTarget(token)).toEqual({ kind: "lab", laboratoryId: labId });
  const data = {
    laboratoryId: labId,
    purpose: "Presensi QR laboratorium",
    qr: token,
  };
  const a = await checkin(student, data);
  expect(a.pcId).toBeNull();
  expect(a.status).toBe("ACTIVE");
  const b = await checkin(student, data),
    c = await checkin(student, data);
  expect(b.id).toBe(a.id);
  expect(c.id).toBe(a.id);
  expect(c.checkIn).toEqual(a.checkIn);
  expect(c.status).toBe("COMPLETED");
  expect(+c.checkOut!).toBeGreaterThanOrEqual(+b.checkOut!);
});
it("QR lab lain tidak dapat dipakai untuk mengubah laboratorium tujuan", async () => {
  await expect(
    checkin(student, {
      laboratoryId: labId,
      purpose: "Percobaan QR lab lain",
      qr: signLabQR("other-lab"),
    }),
  ).rejects.toThrow("laboratorium");
  expect(
    await db.attendanceSession.count({ where: { userId: student.id } }),
  ).toBe(0);
});

it("QR cetak tidak kedaluwarsa dua menit dan QR lama ditolak setelah diganti", async () => {
  const token = signPrintedLabQR(labId, 0);
  vi.useFakeTimers();
  try {
    vi.advanceTimersByTime(365 * 86400000);
    expect(verifyQRTarget(token)).toEqual({
      kind: "lab",
      laboratoryId: labId,
      version: 0,
    });
  } finally {
    vi.useRealTimers();
  }
  await db.laboratory.update({
    where: { id: labId },
    data: { qrVersion: { increment: 1 } },
  });
  await expect(
    checkin(student, {
      laboratoryId: labId,
      purpose: "Percobaan QR cetak lama",
      qr: token,
    }),
  ).rejects.toThrow("diganti");
  const r = await checkin(student, {
    laboratoryId: labId,
    purpose: "QR cetak terbaru",
    qr: signPrintedLabQR(labId, 1),
  });
  expect(r.laboratoryId).toBe(labId);
});
it("nama mahasiswa mengikuti Google dan perubahan profil tidak dapat menargetkan akun lain", async () => {
  state.user = student;
  const original = await db.user.findUniqueOrThrow({ where: { id: other.id } });
  const originalStudent = await db.user.findUniqueOrThrow({
    where: { id: student.id },
  });
  const r = await action(
    new Request("http://localhost:3000/api/action", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "profile",
        id: other.id,
        name: "Nama saya diperbarui",
      }),
    }),
  );
  expect(r.status).toBe(200);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: student.id } })).name,
  ).toBe(originalStudent.name);
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: other.id } })).name,
  ).toBe(original.name);
});

it("API menolak check-in dan checkout manual mahasiswa tanpa mengubah presensi", async () => {
  state.user = student;
  const send = (data: Record<string, unknown>) =>
    action(
      new Request("http://localhost:3000/api/action", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }),
    );
  const denied = await send({
    action: "checkin",
    laboratoryId: labId,
    purpose: "Percobaan masuk manual",
  });
  expect(denied.status).toBe(400);
  expect((await denied.json()).error).toContain("QR");
  expect(
    await db.attendanceSession.count({ where: { userId: student.id } }),
  ).toBe(0);
  const first = await checkin(student, {
    laboratoryId: labId,
    purpose: "Masuk dengan QR laboratorium",
    qr: signPrintedLabQR(labId, 0),
  });
  const exit = await send({ action: "checkout", id: first.id });
  expect(exit.status).toBe(400);
  expect((await exit.json()).error).toContain("QR");
  const unchanged = await db.attendanceSession.findUniqueOrThrow({
    where: { id: first.id },
  });
  expect(unchanged.status).toBe("ACTIVE");
  expect(unchanged.checkOut).toBeNull();
});

it("pencarian ekspor presensi dan peminjaman mengikuti nama, PC, atau tujuan", async () => {
  await checkin(student, {
    laboratoryId: labId,
    purpose: "Kunjungan untuk ekspor khusus",
    qr: signLabQR(labId),
  });
  await reserve(student, input());
  for (const kind of ["attendance", "requests"]) {
    const matching = await reports(
      new Request(
        `http://localhost:3000/api/reports?format=csv&lab=${labId}&kind=${kind}&q=Pengguna%20uji%201`,
      ),
    );
    expect(matching.status).toBe(200);
    expect(await matching.text()).toContain("Pengguna uji 1");
    const excluded = await reports(
      new Request(
        `http://localhost:3000/api/reports?format=csv&lab=${labId}&kind=${kind}&q=tidak-ada-hasil`,
      ),
    );
    expect(excluded.status).toBe(200);
    expect(await excluded.text()).not.toContain("Pengguna uji 1");
  }
});
