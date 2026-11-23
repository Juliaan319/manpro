export type UsageSession = {
  id: string;
  userId: string;
  pcId: string | null;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  status: string;
};
export type UsagePC = { id: string; code: string };
const dayMs = 86400000;
export function wibDay(value: string | Date) {
  return new Date(value).toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });
}
export function validUsageDuration(s: UsageSession) {
  return (
    s.status === "COMPLETED" &&
    s.checkOut !== null &&
    Number.isFinite(Date.parse(s.checkIn)) &&
    Number.isFinite(Date.parse(s.checkOut)) &&
    Date.parse(s.checkOut) >= Date.parse(s.checkIn) &&
    s.durationMinutes !== null &&
    Number.isFinite(s.durationMinutes) &&
    s.durationMinutes >= 0
  );
}
export function usageReviewReason(s: UsageSession, asOf: string) {
  if (s.status === "ACTIVE" && wibDay(s.checkIn) < wibDay(asOf))
    return "Belum scan keluar sejak hari sebelumnya";
  if (s.status === "CORRECTED")
    return "Waktu keluar tidak diketahui setelah koreksi";
  if (s.status === "COMPLETED" && !validUsageDuration(s))
    return "Waktu keluar atau durasi belum lengkap";
  return "";
}
function dayTime(day: string) {
  return Date.parse(day + "T00:00:00+07:00");
}
export function usageDate(day: string, year = true) {
  return new Date(dayTime(day)).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" as const } : {}),
  });
}
export function usageDuration(minutes: number) {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} menit`;
  const hours = Math.floor(rounded / 60),
    rest = rounded % 60;
  return `${hours} jam${rest ? ` ${rest} menit` : ""}`;
}
export function buildUsageReport(
  sessions: UsageSession[],
  pcs: UsagePC[],
  asOf: string,
  from = "",
  to = "",
) {
  const completed = sessions.filter(validUsageDuration);
  const review = sessions.filter((s) => usageReviewReason(s, asOf));
  const minutes = completed.reduce((n, s) => n + s.durationMinutes!, 0);
  const pcMinutes = completed
    .filter((s) => s.pcId)
    .reduce((n, s) => n + s.durationMinutes!, 0);
  const days = sessions.map((s) => wibDay(s.checkIn)).sort();
  const start = from || days[0] || wibDay(asOf);
  const end = to || days.at(-1) || start;
  const invalidRange =
    !Number.isFinite(dayTime(start)) ||
    !Number.isFinite(dayTime(end)) ||
    start > end;
  const span = invalidRange
    ? 0
    : Math.round((dayTime(end) - dayTime(start)) / dayMs) + 1;
  const bucketDays = Math.max(1, Math.ceil(span / 21));
  const buckets = Array.from(
    { length: Math.min(21, Math.ceil(span / bucketDays)) },
    (_, i) => {
      const a = wibDay(new Date(dayTime(start) + i * bucketDays * dayMs));
      const b = wibDay(
        new Date(Math.min(dayTime(end), dayTime(a) + (bucketDays - 1) * dayMs)),
      );
      return {
        start: a,
        end: b,
        label: usageDate(a, false),
        period: a === b ? usageDate(a) : `${usageDate(a)} – ${usageDate(b)}`,
        visits: 0,
        pcMinutes: 0,
        visitMinutes: 0,
        pcHours: 0,
        visitHours: 0,
      };
    },
  );
  for (const s of sessions) {
    const index = Math.floor(
      (dayTime(wibDay(s.checkIn)) - dayTime(start)) / dayMs / bucketDays,
    );
    const bucket = buckets[index];
    if (!bucket || wibDay(s.checkIn) > end) continue;
    bucket.visits++;
    if (validUsageDuration(s)) {
      if (s.pcId) bucket.pcMinutes += s.durationMinutes!;
      else bucket.visitMinutes += s.durationMinutes!;
    }
  }
  for (const b of buckets) {
    b.pcHours = Number((b.pcMinutes / 60).toFixed(2));
    b.visitHours = Number((b.visitMinutes / 60).toFixed(2));
  }
  const byPC = pcs
    .map((pc) => {
      const rows = sessions.filter((s) => s.pcId === pc.id);
      const valid = rows.filter(validUsageDuration);
      return {
        ...pc,
        visits: rows.length,
        visitors: new Set(rows.map((s) => s.userId)).size,
        minutes: valid.reduce((n, s) => n + s.durationMinutes!, 0),
        review: rows.filter((s) => usageReviewReason(s, asOf)).length,
        lastVisit:
          rows
            .map((s) => s.checkIn)
            .sort()
            .at(-1) || null,
      };
    })
    .sort(
      (a, b) =>
        b.minutes - a.minutes ||
        b.visits - a.visits ||
        a.code.localeCompare(b.code),
    );
  return {
    visitors: new Set(sessions.map((s) => s.userId)).size,
    visits: sessions.length,
    completedCount: completed.length,
    minutes,
    pcMinutes,
    averageMinutes: completed.length ? minutes / completed.length : null,
    review,
    active: sessions.filter((s) => s.status === "ACTIVE").length,
    byPC,
    buckets,
    bucketDays,
    start,
    end,
    invalidRange,
  };
}
