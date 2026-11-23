"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  Monitor,
  Plus,
  UserRound,
} from "lucide-react";
type Request = {
  id: string;
  userId: string;
  user: { name: string };
  pc: { code: string };
  laboratoryId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  status: string;
};
type Session = {
  id: string;
  userId: string;
  user: { name: string };
  pc: { code: string } | null;
  laboratoryId: string;
  checkIn: string;
  purpose: string;
  status: string;
  durationMinutes: number | null;
};
type Props = {
  requests: Request[];
  attendance: Session[];
  labs: { id: string; code: string }[];
  user: { id: string; role: string };
  onReserve: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onCheckout: (id: string) => void;
};
const time = (v: string) =>
  new Date(v).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function ActivityBoard({
  requests,
  attendance,
  labs,
  user,
  onReserve,
  onApprove,
  onReject,
  onCheckout,
}: Props) {
  const columns = [
    {
      key: "pending",
      title: "Menunggu",
      hint: "Pengajuan baru",
      status: "PENDING",
    },
    {
      key: "approved",
      title: "Disetujui",
      hint: "Siap digunakan",
      status: "APPROVED",
    },
    {
      key: "active",
      title: "Sedang digunakan",
      hint: "Sesi berlangsung",
      status: "ACTIVE",
    },
    {
      key: "done",
      title: "Selesai",
      hint: "Aktivitas tercatat",
      status: "COMPLETED",
    },
  ];
  return (
    <section
      className="activity-board"
      aria-label="Papan aktivitas laboratorium"
    >
      {columns.map((column) => {
        const sessions =
          column.key === "active"
            ? attendance.filter((s) => s.status === "ACTIVE")
            : [];
        const items =
          column.key === "active"
            ? []
            : requests
                .filter((r) => r.status === column.status)
                .sort((a, b) =>
                  column.key === "done"
                    ? +new Date(b.endAt) - +new Date(a.endAt)
                    : +new Date(a.startAt) - +new Date(b.startAt),
                );
        const total = items.length + sessions.length;
        return (
          <section
            className={"board-column " + column.key}
            key={column.key}
            aria-label={column.title}
          >
            <div className="column-heading">
              <span className="column-dot" />
              <h2>{column.title}</h2>
              <span className="column-count">{total}</span>
            </div>
            <p className="column-hint">{column.hint}</p>
            {user.role !== "HEAD_LAB" && (
              <button className="board-add" onClick={onReserve}>
                <Plus size={14} />
                Ajukan peminjaman
              </button>
            )}
            <div className="board-cards">
              {items.slice(0, 3).map((r) => (
                <article className="activity-card" key={r.id}>
                  <div className="card-tags">
                    <span
                      className={
                        "lab-tag " +
                        (labs.find((l) => l.id === r.laboratoryId)?.code ===
                        "VR"
                          ? "vr"
                          : "ai")
                      }
                    >
                      Laboratorium{" "}
                      {labs.find((l) => l.id === r.laboratoryId)?.code}
                    </span>
                    <span className="device-tag">{r.pc.code}</span>
                  </div>
                  <h3>{r.purpose}</h3>
                  <p className="card-description">
                    {column.key === "pending"
                      ? "Menunggu peninjauan pengelola laboratorium."
                      : column.key === "approved"
                        ? "Reservasi telah disetujui. Gunakan PC sesuai jadwal Anda."
                        : "Peminjaman sudah selesai dan tersimpan dalam riwayat."}
                  </p>
                  <div className="card-schedule">
                    <CalendarDays size={14} />
                    <span>
                      {time(r.startAt)}
                      <small>s.d. {time(r.endAt)} WIB</small>
                    </span>
                  </div>
                  {user.role === "LAB_ADMIN" &&
                    column.key === "pending" &&
                    r.userId !== user.id && (
                      <div className="board-review">
                        <button onClick={() => onApprove(r.id)}>
                          <Check size={14} />
                          Setujui
                        </button>
                        <button onClick={() => onReject(r.id)}>Tolak</button>
                      </div>
                    )}
                  <div className="activity-card-footer">
                    <span className="person-name">
                      <span className="person-avatar">
                        {r.user.name
                          .split(" ")
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      {r.user.name}
                    </span>
                    <Link
                      aria-label={"Lihat peminjaman " + r.pc.code}
                      href={
                        user.role === "USER"
                          ? "/app/riwayat-peminjaman"
                          : user.role === "LAB_ADMIN"
                            ? "/app/pengajuan"
                            : "/app/riwayat"
                      }
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
              {sessions.slice(0, 3).map((s) => (
                <article className="activity-card active-card" key={s.id}>
                  <div className="card-tags">
                    <span className="lab-tag active-tag">Sesi aktif</span>
                    <span className="device-tag">
                      {s.pc?.code || "Tanpa PC"}
                    </span>
                  </div>
                  <h3>{s.purpose}</h3>
                  <p className="card-description">
                    {s.user.name} sedang beraktivitas di laboratorium{" "}
                    {labs.find((l) => l.id === s.laboratoryId)?.code}.
                  </p>
                  <div className="card-schedule">
                    <Clock size={14} />
                    <span>
                      Masuk {time(s.checkIn)}
                      <small>Waktu keluar belum tercatat</small>
                    </span>
                  </div>
                  <div className="session-indicator">
                    <i />
                    Presensi berlangsung
                  </div>
                  <div className="activity-card-footer">
                    <span className="person-name">
                      <UserRound size={15} />
                      {s.user.name}
                    </span>
                    {s.userId === user.id ? (
                      <button
                        className="small"
                        onClick={() => onCheckout(s.id)}
                      >
                        Keluar
                      </button>
                    ) : (
                      <Link href="/app/riwayat" aria-label="Lihat riwayat sesi">
                        <ArrowUpRight size={16} />
                      </Link>
                    )}
                  </div>
                </article>
              ))}
              {total === 0 && (
                <div className="board-empty">
                  <span>
                    <Monitor size={22} />
                  </span>
                  <strong>
                    {column.key === "pending"
                      ? "Semua pengajuan ditinjau"
                      : column.key === "approved"
                        ? "Belum ada reservasi"
                        : column.key === "active"
                          ? "Laboratorium sedang tenang"
                          : "Belum ada aktivitas selesai"}
                  </strong>
                  <p>
                    {column.key === "pending"
                      ? "Pengajuan baru akan muncul di sini."
                      : column.key === "approved"
                        ? "Jadwal yang disetujui akan tampil di kolom ini."
                        : column.key === "active"
                          ? "Sesi akan muncul saat pengguna melakukan check-in."
                          : "Riwayat penggunaan akan tersimpan secara otomatis."}
                  </p>
                </div>
              )}
              {total > 3 && (
                <Link
                  className="board-more"
                  href={
                    user.role === "USER"
                      ? "/app/riwayat-peminjaman"
                      : "/app/riwayat"
                  }
                >
                  Lihat {total - 3} aktivitas lainnya <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </section>
        );
      })}
    </section>
  );
}
