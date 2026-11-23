import { PDFDocument } from "pdf-lib";
import { encode } from "next-auth/jwt";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { signPrintedLabQR } from "../src/lib/qr";
import { test, expect, Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.goto("/login");
  if (email.endsWith("@john.petra.ac.id")) {
    // A signed session fixture tests student workflows without Google credentials.
    // Real Google profile validation and callbacks are covered by google-auth.test.ts.
    const fixture = new PrismaClient();
    try {
      const user = await fixture.user.findUniqueOrThrow({ where: { email } });
      const value = await encode({
        secret: process.env.NEXTAUTH_SECRET!,
        maxAge: 3600,
        token: {
          sub: user.id,
          name: user.name,
          email: user.email,
          authProvider: "google",
        },
      });
      await page.context().addCookies([
        {
          name: "next-auth.session-token",
          value,
          url: "http://localhost:3000",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    } finally {
      await fixture.$disconnect();
    }
    await page.goto("/app/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dasbor saya", exact: true }),
    ).toBeVisible();
    return;
  }
  await page.locator(".staff-login summary").click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill("LabTrackDemo2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Aktivitas laboratorium|Dasbor saya/ }),
  ).toBeVisible();
}
test("sesi tiap peran, navigasi, dan keluar; login pengelola menggunakan kata sandi", async ({
  page,
}) => {
  for (const email of [
    "c140000001@john.petra.ac.id",
    "admin@labtrack.test",
    "kepala@labtrack.test",
  ]) {
    await login(page, email);
    const links = await page
      .locator("nav a")
      .evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLAnchorElement).pathname),
      );
    for (const href of links) {
      await page.goto(href);
      await expect(page.locator(".page-heading h1")).toBeVisible();
      await expect(
        page.getByText("Akses dibatasi", { exact: true }),
      ).toHaveCount(0);
      if (href === "/app/profil") {
        await expect(page.locator(".profile-identity")).toContainText(email);
        await expect(page.locator(".profile-identity")).not.toContainText(
          email === "admin@labtrack.test" ? "Andi Pratama" : "Maria Santoso",
        );
      }
    }
    await page.getByRole("button", { name: "Keluar akun" }).click();
    await expect(page).toHaveURL(/login/);
  }
});
test("mahasiswa mengajukan lalu membatalkan peminjaman melalui UI", async ({
  page,
}) => {
  await login(page, "c140000001@john.petra.ac.id");
  await page.goto("/app/peminjaman");
  await page.getByRole("button", { name: "Ajukan peminjaman" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Komputer", { exact: true }).selectOption("ai-pc-03");
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await dialog.getByLabel("Mulai (WIB)", { exact: true }).fill(date + "T09:00");
  await dialog
    .getByLabel("Selesai (WIB)", { exact: true })
    .fill(date + "T10:00");
  const purpose = "Pengujian browser " + Date.now();
  await dialog.getByLabel("Tujuan peminjaman").fill(purpose);
  await dialog.getByRole("button", { name: "Simpan" }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.locator("tr").filter({ hasText: purpose });
  await expect(row).toContainText("Menunggu");
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Batalkan" }).click();
  await expect(row).toContainText("Dibatalkan");
});
test("mahasiswa hanya presensi melalui QR; scan masuk dan keluar menghitung durasi", async ({
  page,
}) => {
  const fixture = new PrismaClient();
  const lab = await fixture.laboratory.create({
    data: {
      code: "WALK-" + Date.now(),
      name: "Laboratorium uji presensi",
      description: "Fixture browser",
      location: "Pengujian",
    },
  });
  try {
    await login(page, "c140000001@john.petra.ac.id");
    await page.goto("/app/presensi");
    await expect(
      page.getByRole("button", { name: "Masuk laboratorium", exact: true }),
    ).toHaveCount(0);
    const qrURL =
      "/checkin?token=" + encodeURIComponent(signPrintedLabQR(lab.id, 0));
    await page.goto(qrURL);
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Tujuan aktivitas")
      .fill("Pengujian presensi browser");
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(dialog).not.toBeVisible();
    const row = page
      .locator("tr")
      .filter({ hasText: "Pengujian presensi browser" });
    await expect(row).toContainText("Aktif");
    await expect(
      row.getByRole("button", { name: "Keluar", exact: true }),
    ).toHaveCount(0);
    await page.goto(qrURL);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Simpan" })
      .click();
    await expect(row).toHaveCount(0);
    await page.goto("/app/riwayat-presensi");
    await expect(
      page
        .locator("tr")
        .filter({ hasText: "Pengujian presensi browser" })
        .first(),
    ).toContainText("0 menit");
  } finally {
    await fixture.attendanceSession.deleteMany({
      where: { laboratoryId: lab.id },
    });
    await fixture.laboratory.delete({ where: { id: lab.id } });
    await fixture.$disconnect();
  }
});
test("admin mengelola laboratorium dan QR; kepala lab mengekspor laporan", async ({
  page,
}) => {
  await login(page, "admin@labtrack.test");
  await page.goto("/app/laboratorium");
  await page.getByRole("button", { name: "Tambah laboratorium" }).click();
  const dialog = page.getByRole("dialog");
  const name = "Laboratorium Uji Browser " + Date.now();
  await dialog.getByLabel("Kode", { exact: true }).fill("UI-" + Date.now());
  await dialog.getByLabel("Nama laboratorium").fill(name);
  await dialog
    .getByLabel("Deskripsi")
    .fill("Laboratorium sementara untuk verifikasi UI");
  await dialog.getByLabel("Lokasi").fill("Ruang uji");
  await dialog.getByRole("button", { name: "Simpan" }).click();
  await expect(dialog).not.toBeVisible();
  const card = page.locator(".lab-card").filter({ hasText: name });
  await expect(card).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Hapus", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.goto("/app/laboratorium");
  await page.getByRole("button", { name: "QR presensi lab" }).first().click();
  await expect(
    page.getByAltText("Kode QR presensi laboratorium"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tutup dialog" }).click();
  await page.getByRole("button", { name: "Keluar akun" }).click();
  await expect(page).toHaveURL(/login/);
  await login(page, "kepala@labtrack.test");
  await page.goto("/app/laporan");
  await page.getByLabel("Filter laboratorium").selectOption("lab-ai");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "CSV presensi" }).click();
  expect((await download).suggestedFilename()).toBe("labtrack.csv");
});
test("otorisasi HTTP dan pengalihan halaman privat", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/data")).status()).toBe(401);
  expect((await request.get("/api/reports")).status()).toBe(403);
  expect((await request.get("/api/qr?pc=ai-pc-01")).status()).toBe(403);
  await login(page, "c140000001@john.petra.ac.id");
  await page.goto("/app/pengguna");
  await expect(page).toHaveURL(/app\/dashboard/);
  expect((await page.request.get("/api/reports")).status()).toBe(403);
});
test("tampilan desktop dan ponsel tanpa overflow horizontal", async ({
  page,
}) => {
  await login(page, "admin@labtrack.test");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/dashboard");
  await expect(page.locator(".operations-grid")).toBeVisible();
  await page.screenshot({
    path: ".local/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await page.getByRole("link", { name: "Monitoring PC", exact: true }).click();
  await expect(page.locator(".pc-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("halaman publik dan portal mahasiswa responsif", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Laboratorium Informatika/ }),
  ).toBeVisible();
  await expect(page.locator(".hero-photo img")).toBeVisible();
  await page.screenshot({
    path: ".local/landing-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/landing-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".public-mobile-menu summary").click();
  await expect(page.locator(".public-mobile-menu a").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Buat akun|Daftar sekarang/ }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.post("/api/register", {
        data: { email: "c140000099@john.petra.ac.id" },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/mahasiswa");
  await expect(
    page.getByRole("heading", { name: "Masuk LabTrack" }),
  ).toBeVisible();
  await login(page, "c140000001@john.petra.ac.id");
  await expect(
    page.getByRole("heading", { name: "Riwayat pemesanan terakhir saya" }),
  ).toBeVisible();
  await expect(page.locator(".student-pcs")).toHaveCount(0);
  const own = await (await page.request.get("/api/data")).json();
  expect(
    own.requests.every((r: { userId: string }) => r.userId === own.user.id),
  ).toBe(true);
  expect(
    own.attendance.every((r: { userId: string }) => r.userId === own.user.id),
  ).toBe(true);
  expect(own.users).toHaveLength(0);
  expect(own.audits).toHaveLength(0);
  await expect(page.locator(".activity-board")).toHaveCount(0);
  await page.screenshot({
    path: ".local/student-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: ".local/student-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(await page.locator(".icon-rail").count()).toBe(0);
});

test("QR tiga kali menjaga jam masuk pertama dan memperbarui jam keluar terakhir", async ({
  page,
}) => {
  const fixture = new PrismaClient();
  const lab = await fixture.laboratory.create({
    data: {
      code: "QR-" + Date.now(),
      name: "Laboratorium uji QR",
      description: "Fixture browser",
      location: "Pengujian",
    },
  });
  const pc = await fixture.pC.create({
    data: {
      code: "QR-PC-" + Date.now(),
      name: "PC QR pengujian",
      laboratoryId: lab.id,
      description: "Fixture",
      cpu: "Uji",
      ram: "Uji",
    },
  });
  try {
    await login(page, "c140000001@john.petra.ac.id");
    const token = signPrintedLabQR(lab.id, 0);
    let first: string | null = null;
    let previousOut = 0;
    for (let i = 0; i < 3; i++) {
      await page.goto("/app/presensi");
      await page.evaluate(() => {
        if (navigator.mediaDevices)
          Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
            configurable: true,
            value: async () => {
              throw new DOMException("Denied", "NotAllowedError");
            },
          });
      });
      await page
        .getByRole("button", { name: "Pindai QR laboratorium", exact: true })
        .click();
      await page
        .getByLabel("Tautan QR laboratorium (alternatif kamera)", {
          exact: true,
        })
        .fill(
          "http://localhost:3000/checkin?token=" + encodeURIComponent(token),
        );
      await page
        .getByRole("button", { name: "Buka QR laboratorium", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Scan presensi harian" }),
      ).toBeVisible();
      await dialog
        .getByLabel("Tujuan aktivitas")
        .fill("Pengujian tiga scan QR");
      await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      const rows = await fixture.attendanceSession.findMany({
        where: { userId: "demo-student", laboratoryId: lab.id },
      });
      expect(rows).toHaveLength(1);
      if (!first) first = rows[0].checkIn.toISOString();
      expect(rows[0].checkIn.toISOString()).toBe(first);
      expect(rows[0].status).toBe(i === 0 ? "ACTIVE" : "COMPLETED");
      if (i > 0) {
        expect(+rows[0].checkOut!).toBeGreaterThanOrEqual(previousOut);
        previousOut = +rows[0].checkOut!;
      }
    }
  } finally {
    const sessions = await fixture.attendanceSession.findMany({
      where: { laboratoryId: lab.id },
      select: { id: true },
    });
    await fixture.auditLog.deleteMany({
      where: { entityId: { in: sessions.map((s) => s.id) } },
    });
    await fixture.attendanceSession.deleteMany({
      where: { laboratoryId: lab.id },
    });
    await fixture.pC.delete({ where: { id: pc.id } });
    await fixture.laboratory.delete({ where: { id: lab.id } });
    await fixture.$disconnect();
  }
});

test("peminjaman hanya menampilkan 10 PC AI tanpa pilihan VR", async ({
  page,
}) => {
  await login(page, "c140000001@john.petra.ac.id");
  await page.goto("/app/peminjaman");
  await expect(page.locator(".student-pc")).toHaveCount(10);
  await expect(page.locator(".student-pcs")).not.toContainText("VR-PC");
  await expect(page.locator(".calendar-row")).toHaveCount(10);
  await expect(
    page
      .getByLabel("Filter laboratorium")
      .getByRole("option", { name: "Laboratorium VR", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ajukan peminjaman", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog
      .getByLabel("Laboratorium", { exact: true })
      .getByRole("option", { name: "Laboratorium VR", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByLabel("Komputer", { exact: true }),
  ).not.toContainText("VR-PC");
});

test("remote mahasiswa wajib surat; admin mengunduh dan menyetujui lalu status PC dapat diubah", async ({
  page,
}) => {
  const fixture = new PrismaClient();
  const lab = await fixture.laboratory.findUniqueOrThrow({
    where: { code: "AI" },
  });
  const pc = await fixture.pC.create({
    data: {
      code: "REMOTE-UI-" + Date.now(),
      laboratoryId: lab.id,
      name: "Komputer remote pengujian",
      cpu: "Uji",
      ram: "32 GB",
      description: "Fixture browser",
    },
  });
  try {
    await login(page, "c140000001@john.petra.ac.id");
    await page.goto("/app/remote");
    const formResponse = await page.request.get("/api/remote/form");
    expect(formResponse.status()).toBe(200);
    const pdf = await PDFDocument.load(await formResponse.body());
    expect(pdf.getForm().getFields().length).toBeGreaterThan(5);
    pdf
      .getForm()
      .getTextField("tujuan")
      .setText("Penelitian pengujian remote beberapa hari");
    const bytes = await pdf.save();
    await page
      .getByRole("button", { name: "Ajukan remote PC", exact: true })
      .click();
    const panel = page.locator(".remote-form");
    await panel
      .getByRole("combobox", { name: "Komputer AI" })
      .selectOption(pc.id);
    const start = new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
      end = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    await panel
      .getByLabel("Mulai (WIB)", { exact: true })
      .fill(start + "T09:00");
    await panel
      .getByLabel("Selesai (WIB)", { exact: true })
      .fill(end + "T17:00");
    const purpose = "Permohonan remote browser " + Date.now();
    await panel.getByLabel("Tujuan penggunaan").fill(purpose);
    await panel.getByLabel(/Surat permohonan yang sudah diisi/).setInputFiles({
      name: "surat-remote-ui.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
    await panel.getByRole("button", { name: "Kirim pengajuan remote" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.locator("tr").filter({ hasText: purpose })).toContainText(
      "Menunggu",
    );
    await page.screenshot({
      path: ".local/remote-student.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Keluar akun" }).click();
    await expect(page).toHaveURL(/login/);
    await login(page, "admin@labtrack.test");
    await page.goto("/app/remote");
    const row = page.locator("tr").filter({ hasText: purpose });
    const downloadPromise = page.waitForEvent("download");
    await row.getByRole("link", { name: "Unduh surat" }).click();
    expect((await downloadPromise).suggestedFilename()).toBe(
      "surat-remote-ui.pdf",
    );
    await row.getByRole("button", { name: "Setujui", exact: true }).click();
    await page
      .locator(".remote-form")
      .getByLabel(/Tautan akses/)
      .fill("https://example.org/panduan-remote");
    await page.getByRole("button", { name: "Simpan keputusan" }).click();
    await expect(row).toContainText("Disetujui");
    await page.screenshot({
      path: ".local/remote-admin.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.goto("/app/pc");
    const card = page.locator(".pc-card").filter({ hasText: pc.code });
    await card.getByRole("button", { name: "Ubah PC" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Status operasional")
      .selectOption("REMOTE");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Simpan", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(card).toContainText("Terremote");
    await page.getByRole("button", { name: "Keluar akun" }).click();
    await expect(page).toHaveURL(/login/);
    await login(page, "c140000001@john.petra.ac.id");
    await page.goto("/app/remote");
    const ownRow = page.locator("tr").filter({ hasText: purpose });
    await expect(ownRow).toContainText("Disetujui");
    await expect(
      ownRow.getByRole("link", { name: "Petunjuk akses remote" }),
    ).toHaveAttribute("href", "https://example.org/panduan-remote");
  } finally {
    const reqs = await fixture.remoteRequest.findMany({
      where: { pcId: pc.id },
      select: { id: true },
    });
    await fixture.auditLog.deleteMany({
      where: { entityId: { in: [pc.id, ...reqs.map((r) => r.id)] } },
    });
    await fixture.remoteRequest.deleteMany({ where: { pcId: pc.id } });
    await fixture.pC.delete({ where: { id: pc.id } });
    await fixture.$disconnect();
  }
});

test("login mahasiswa hanya Google dan sesi kata sandi lama ditolak", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Masuk dengan Google", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).not.toBeVisible();
  await page.locator(".staff-login summary").click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("c140000001@john.petra.ac.id");
  await page
    .getByLabel("Kata sandi", { exact: true })
    .fill("LabTrackDemo2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.locator(".auth-box").getByRole("alert")).toContainText(
    "hanya untuk admin/kepala lab",
  );
  await expect(page).toHaveURL(/login/);
  const fixture = new PrismaClient();
  try {
    const user = await fixture.user.findUniqueOrThrow({
      where: { email: "c140000001@john.petra.ac.id" },
    });
    const value = await encode({
      secret: process.env.NEXTAUTH_SECRET!,
      token: {
        sub: user.id,
        name: user.name,
        email: user.email,
        authProvider: "credentials",
      },
    });
    await page.context().addCookies([
      {
        name: "next-auth.session-token",
        value,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/login/);
    expect((await page.request.get("/api/data")).status()).toBe(401);
  } finally {
    await fixture.$disconnect();
  }
});

test("riwayat dan laporan satu menu; metrik, periode, tinjauan, dan ekspor mengikuti data", async ({
  page,
}) => {
  const fixture = new PrismaClient();
  const key = Date.now().toString();
  const lab = await fixture.laboratory.create({
    data: {
      code: "REP-" + key,
      name: "Lab analisis uji " + key,
      description: "Fixture analisis",
      location: "Pengujian",
    },
  });
  const user1 = await fixture.user.create({
    data: {
      email: "report1-" + key + "@example.test",
      name: "Mahasiswa laporan satu",
      role: "USER",
      userType: "STUDENT",
      passwordHash: "test-only",
    },
  });
  const user2 = await fixture.user.create({
    data: {
      email: "report2-" + key + "@example.test",
      name: "Mahasiswa laporan dua",
      role: "USER",
      userType: "STUDENT",
      passwordHash: "test-only",
    },
  });
  const pc = await fixture.pC.create({
    data: {
      code: "REPORT-PC-" + key,
      name: "PC analisis",
      laboratoryId: lab.id,
      description: "Fixture",
      cpu: "Test",
      ram: "32 GB",
    },
  });
  try {
    await fixture.attendanceSession.createMany({
      data: [
        {
          userId: user1.id,
          laboratoryId: lab.id,
          pcId: pc.id,
          purpose: "Sesi laporan pertama",
          checkIn: new Date("2026-10-01T02:00:00Z"),
          checkOut: new Date("2026-10-01T04:00:00Z"),
          durationMinutes: 120,
          status: "COMPLETED",
        },
        {
          userId: user1.id,
          laboratoryId: lab.id,
          pcId: pc.id,
          purpose: "Sesi laporan kedua",
          checkIn: new Date("2026-10-02T02:00:00Z"),
          checkOut: new Date("2026-10-02T03:00:00Z"),
          durationMinutes: 60,
          status: "COMPLETED",
        },
        {
          userId: user1.id,
          laboratoryId: lab.id,
          pcId: pc.id,
          purpose: "Sesi belum keluar",
          checkIn: new Date("2026-10-03T02:00:00Z"),
          status: "ACTIVE",
        },
        {
          userId: user2.id,
          laboratoryId: lab.id,
          purpose: "Sesi dikoreksi",
          checkIn: new Date("2026-10-03T03:00:00Z"),
          status: "CORRECTED",
          correctionReason: "Waktu akhir tidak diketahui saat pengujian",
        },
      ],
    });
    await login(page, "admin@labtrack.test");
    await page.goto("/app/riwayat");
    await expect(page).toHaveURL(/app\/laporan/);
    await expect(page.locator('nav a[href="/app/laporan"]')).toHaveCount(1);
    await expect(page.locator('nav a[href="/app/riwayat"]')).toHaveCount(0);
    await page
      .getByLabel("Filter laboratorium", { exact: true })
      .selectOption(lab.id);
    const metrics = page.locator(".report-metrics > section");
    await expect(metrics.nth(0)).toContainText("2 orang");
    await expect(metrics.nth(0)).toContainText("4 kunjungan");
    await expect(metrics.nth(1)).toContainText("1 jam 30 menit");
    await expect(metrics.nth(2)).toContainText("3 jam");
    await expect(metrics.nth(3)).toContainText("2 sesi");
    await expect(page.locator(".report-context")).toContainText("Okt");
    await page
      .getByRole("button", { name: "Periksa sesi", exact: true })
      .click();
    await expect(page.locator(".report-attendance tbody tr")).toHaveCount(2);
    await expect(page.locator(".report-attendance")).toContainText(
      "hari sebelumnya",
    );
    await page.getByRole("button", { name: "Semua sesi", exact: true }).click();
    await expect(page.locator(".report-attendance tbody tr")).toHaveCount(4);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({
      path: ".local/report-unified-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/report-unified-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("textbox", { name: "Cari data", exact: true })
      .fill("tidak-ada-hasil");
    await expect(page.locator(".report-empty")).toContainText(
      "Ubah atau reset filter",
    );
    const href = await page
      .getByRole("link", { name: "CSV presensi", exact: true })
      .getAttribute("href");
    expect(href).toContain("q=tidak-ada-hasil");
    const csv = await page.request.get(href!);
    expect(await csv.text()).not.toContain("Mahasiswa laporan satu");
  } finally {
    await fixture.attendanceSession.deleteMany({
      where: { laboratoryId: lab.id },
    });
    await fixture.pC.delete({ where: { id: pc.id } });
    await fixture.user.deleteMany({
      where: { id: { in: [user1.id, user2.id] } },
    });
    await fixture.laboratory.delete({ where: { id: lab.id } });
    await fixture.$disconnect();
  }
});
