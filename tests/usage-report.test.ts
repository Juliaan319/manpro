import { it, expect } from "vitest";
import {
  buildUsageReport,
  usageReviewReason,
  validUsageDuration,
  type UsageSession,
} from "../src/lib/usage-report";
const asOf = "2026-11-17T03:00:00Z";
const pcs = [
  { id: "a", code: "AI-PC-01" },
  { id: "b", code: "AI-PC-02" },
];
function session(v: Partial<UsageSession> = {}): UsageSession {
  return {
    id: "s",
    userId: "one",
    pcId: "a",
    checkIn: "2026-10-01T02:00:00Z",
    checkOut: "2026-10-01T04:00:00Z",
    durationMinutes: 120,
    status: "COMPLETED",
    ...v,
  };
}
it("membedakan pengunjung unik, kunjungan, rata-rata sesi selesai, dan jam PC aktual", () => {
  const rows = [
    session(),
    session({
      id: "s2",
      pcId: null,
      checkIn: "2026-10-02T02:00:00Z",
      checkOut: "2026-10-02T03:00:00Z",
      durationMinutes: 60,
    }),
    session({
      id: "s3",
      userId: "two",
      checkOut: null,
      durationMinutes: null,
      status: "ACTIVE",
    }),
  ];
  const r = buildUsageReport(rows, pcs, asOf);
  expect(r.visitors).toBe(2);
  expect(r.visits).toBe(3);
  expect(r.completedCount).toBe(2);
  expect(r.averageMinutes).toBe(90);
  expect(r.pcMinutes).toBe(120);
  expect(r.minutes).toBe(180);
  expect(r.review).toHaveLength(1);
  expect(r.start).toBe("2026-10-01");
  expect(r.end).toBe("2026-10-02");
  expect(r.buckets[0].pcHours).toBe(2);
  expect(r.buckets[1].visitHours).toBe(1);
});
it("sesi aktif hari ini bukan masalah; sesi hari sebelumnya dan koreksi tanpa waktu perlu diperiksa", () => {
  expect(
    usageReviewReason(
      session({
        status: "ACTIVE",
        checkIn: asOf,
        checkOut: null,
        durationMinutes: null,
      }),
      asOf,
    ),
  ).toBe("");
  expect(
    usageReviewReason(
      session({
        status: "ACTIVE",
        checkIn: "2026-11-16T16:59:59Z",
        checkOut: null,
        durationMinutes: null,
      }),
      asOf,
    ),
  ).toContain("sebelumnya");
  expect(
    usageReviewReason(
      session({ status: "CORRECTED", checkOut: null, durationMinutes: null }),
      asOf,
    ),
  ).toContain("koreksi");
});
it("durasi tidak lengkap, negatif, aktif, atau dikoreksi tidak menambah jam", () => {
  const rows = [
    session({ durationMinutes: -1 }),
    session({ checkOut: null }),
    session({ status: "ACTIVE" }),
    session({ status: "CORRECTED" }),
    session({ checkOut: "2026-09-30T00:00:00Z" }),
  ];
  const r = buildUsageReport(rows, pcs, asOf);
  expect(r.pcMinutes).toBe(0);
  expect(r.averageMinutes).toBeNull();
  expect(rows.every((s) => !validUsageDuration(s))).toBe(true);
});
it("nol menit adalah durasi selesai yang valid dan bukan data hilang", () => {
  const r = buildUsageReport([session({ durationMinutes: 0 })], pcs, asOf);
  expect(r.completedCount).toBe(1);
  expect(r.averageMinutes).toBe(0);
  expect(r.review).toHaveLength(0);
});
it("periode panjang dikelompokkan maksimal 21 titik dengan jumlah durasi terjaga", () => {
  const r = buildUsageReport(
    [session()],
    pcs,
    asOf,
    "2026-01-01",
    "2026-12-31",
  );
  expect(r.buckets.length).toBeLessThanOrEqual(21);
  expect(r.buckets.reduce((n, b) => n + b.pcMinutes, 0)).toBe(120);
  expect(r.bucketDays).toBeGreaterThan(1);
});
it("tanggal memakai WIB dan rentang mengikuti pilihan tanggal", () => {
  const r = buildUsageReport(
    [
      session({
        checkIn: "2026-10-01T17:01:00Z",
        checkOut: "2026-10-01T18:01:00Z",
        durationMinutes: 60,
      }),
    ],
    pcs,
    asOf,
    "2026-10-01",
    "2026-10-03",
  );
  expect(r.buckets[0].visits).toBe(0);
  expect(r.buckets[1].visits).toBe(1);
  expect(r.buckets[2].visits).toBe(0);
});
it("hasil kosong dan tanggal terbalik tidak menghasilkan grafik palsu atau Infinity", () => {
  const empty = buildUsageReport([], pcs, asOf);
  expect(empty.visitors).toBe(0);
  expect(empty.averageMinutes).toBeNull();
  const wrong = buildUsageReport([], pcs, asOf, "2026-11-20", "2026-11-01");
  expect(wrong.invalidRange).toBe(true);
  expect(wrong.buckets).toHaveLength(0);
});
it("ringkasan PC diurutkan durasi dan mempertahankan perangkat tanpa kunjungan", () => {
  const r = buildUsageReport(
    [
      session({ pcId: "b" }),
      session({ id: "s2", pcId: "b", userId: "two", durationMinutes: 60 }),
    ],
    pcs,
    asOf,
  );
  expect(r.byPC[0].code).toBe("AI-PC-02");
  expect(r.byPC[0].visitors).toBe(2);
  expect(r.byPC[0].minutes).toBe(180);
  expect(r.byPC[1].visits).toBe(0);
});
