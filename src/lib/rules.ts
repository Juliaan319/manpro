export function overlaps(a: Date, b: Date, c: Date, d: Date) {
  return a < d && b > c;
}
export function duration(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}
export function connectivity(heartbeat: Date | null, now = new Date()) {
  return heartbeat && now.getTime() - heartbeat.getTime() < 60000
    ? "ONLINE"
    : "OFFLINE";
}
export function assertRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) throw new Error("Anda tidak memiliki izin.");
}
export function interval(startAt: Date, endAt: Date, now = new Date()) {
  if (
    !Number.isFinite(+startAt) ||
    !Number.isFinite(+endAt) ||
    endAt <= startAt
  )
    throw new Error("Waktu selesai harus setelah waktu mulai.");
  if (startAt < now) throw new Error("Waktu mulai tidak boleh di masa lalu.");
}
export const labels: Record<string, string> = {
  ROTATE_LAB_QR: "Penggantian QR cetak laboratorium",
  REMOTE: "Terremote",
  APPROVE_REMOTE: "Persetujuan remote PC",
  REJECT_REMOTE: "Penolakan remote PC",
  REMOTE_TEMPLATE: "Perubahan formulir remote",
  QR_CHECKOUT: "Scan keluar laboratorium",
  QR_REFRESH_CHECKOUT: "Pembaruan scan keluar terakhir",
  APPROVE: "Persetujuan peminjaman",
  REJECT: "Penolakan peminjaman",
  SAVE_LAB: "Penyimpanan laboratorium",
  SAVE_PC: "Penyimpanan komputer",
  deleteLab: "Penghapusan laboratorium",
  deletePC: "Penghapusan komputer",
  CREATE_USER: "Pembuatan pengguna",
  ROTATE_DEVICE_SECRET: "Rotasi rahasia perangkat",
  ASSIST_CHECKIN: "Bantuan masuk laboratorium",
  CORRECT_ATTENDANCE_UNKNOWN_END: "Koreksi presensi tanpa waktu akhir",
  USER: "Mahasiswa",
  LAB_ADMIN: "Administrator",
  HEAD_LAB: "Kepala Laboratorium",
  STUDENT: "Mahasiswa",
  LECTURER: "Dosen",
  STAFF: "Staf",
  EXTERNAL: "Pengunjung eksternal",
  AVAILABLE: "Tersedia",
  RESERVED: "Dipesan",
  IN_USE: "Digunakan",
  MAINTENANCE: "Pemeliharaan",
  UNAVAILABLE: "Tidak tersedia",
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
  EXPIRED: "Kedaluwarsa",
  ACTIVE: "Aktif",
  CORRECTED: "Dikoreksi",
  ONLINE: "Terhubung",
  OFFLINE: "Terputus",
};

export function attendanceDay(now = new Date()) {
  const key = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const start = new Date(key + "T00:00:00+07:00");
  return { key, start, end: new Date(start.getTime() + 86400000) };
}
