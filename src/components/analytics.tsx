"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { labels } from "@/lib/rules";
type Request = { startAt: string; status: string };
type Session = {
  checkIn: string;
  durationMinutes: number | null;
  status: string;
};
type Device = {
  code: string;
  connectivity: string;
  telemetry?: {
    simulated: boolean;
    gpuName: string | null;
    gpuPercent: number | null;
  }[];
};
export default function Analytics({
  requests,
  attendance,
  pcs,
  asOf,
}: {
  asOf: string;
  requests: Request[];
  attendance: Session[];
  pcs: Device[];
}) {
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(asOf);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 5 + i);
    const key = d.toISOString().slice(0, 7);
    return {
      name: d.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        month: "short",
      }),
      jumlah: requests.filter((r) =>
        new Date(r.startAt)
          .toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
          .startsWith(key),
      ).length,
    };
  });
  const distribution = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "COMPLETED",
    "EXPIRED",
  ]
    .map((status) => ({
      name: labels[status],
      value: requests.filter((r) => r.status === status).length,
    }))
    .filter((x) => x.value);
  const colors = [
    "#e5ac41",
    "#5e80ed",
    "#d9717b",
    "#a5adbc",
    "#44ae93",
    "#8d8bad",
  ];
  const now = +new Date(asOf);
  const period = (offset: number) =>
    attendance.filter(
      (s) =>
        +new Date(s.checkIn) >= now - (offset + 7) * 86400000 &&
        +new Date(s.checkIn) < now - offset * 86400000,
    );
  const current = period(0),
    previous = period(7);
  return (
    <>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Pengajuan bulanan</h2>
              <p>Enam bulan terakhir · berdasarkan jadwal peminjaman</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={235}>
            <BarChart data={monthly} margin={{ right: 25, bottom: 15 }}>
              <CartesianGrid vertical={false} stroke="#edf0f5" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                isAnimationActive={false}
                dataKey="jumlah"
                name="Pengajuan"
                fill="#6c82e9"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Distribusi peminjaman</h2>
              <p>Status dari catatan database</p>
            </div>
          </div>
          {distribution.length ? (
            <ResponsiveContainer width="100%" height={235}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={76}
                >
                  {distribution.map((d, i) => (
                    <Cell key={d.name} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty">Belum ada pengajuan.</div>
          )}
        </section>
      </div>
      <div className="mini-stats">
        <div>
          <small>Kunjungan · 7 hari ini</small>
          <strong>{current.length}</strong>
        </div>
        <div>
          <small>Kunjungan · 7 hari sebelumnya</small>
          <strong>{previous.length}</strong>
        </div>
        <div>
          <small>Durasi · 7 hari ini</small>
          <strong>
            {current.reduce((a, s) => a + (s.durationMinutes || 0), 0)} menit
          </strong>
        </div>
        <div>
          <small>Perangkat terhubung</small>
          <strong>
            {pcs.filter((p) => p.connectivity === "ONLINE").length} /{" "}
            {pcs.length}
          </strong>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Ringkasan GPU</h2>
            <p>Data terakhir; konektivitas menentukan kesegaran metrik.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Komputer</th>
                <th>GPU</th>
                <th>Utilisasi</th>
                <th>Sumber data</th>
                <th>Konektivitas</th>
              </tr>
            </thead>
            <tbody>
              {pcs.map((p) => {
                const t = p.telemetry?.[0];
                return (
                  <tr key={p.code}>
                    <td>{p.code}</td>
                    <td>{t?.gpuName || "Tidak tersedia"}</td>
                    <td>
                      {t?.gpuPercent == null
                        ? "Tidak tersedia"
                        : t.gpuPercent.toFixed(1) + "%"}
                    </td>
                    <td>
                      {!t
                        ? "Belum ada data"
                        : t.simulated
                          ? "SIMULASI"
                          : "Perangkat fisik"}
                    </td>
                    <td>{labels[p.connectivity]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
