"use client";
import { useRef, useState } from "react";
import {
  Users,
  Clock,
  Monitor,
  ClipboardList,
  ArrowDownToLine,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  buildUsageReport,
  usageDate,
  usageDuration,
  usageReviewReason,
  type UsageSession,
  type UsagePC,
} from "@/lib/usage-report";

type Props<S extends UsageSession, R> = {
  sessions: S[];
  requests: R[];
  pcs: UsagePC[];
  asOf: string;
  from: string;
  to: string;
  attendanceTable: (rows: S[]) => React.ReactNode;
  requestTable: (rows: R[]) => React.ReactNode;
  exportURL: (format: string, kind?: string) => string;
  onReset: () => void;
};
export default function UsageReport<S extends UsageSession, R>({
  sessions,
  requests,
  pcs,
  asOf,
  from,
  to,
  attendanceTable,
  requestTable,
  exportURL,
  onReset,
}: Props<S, R>) {
  const report = buildUsageReport(sessions, pcs, asOf, from, to);
  const [reviewOnly, setReviewOnly] = useState(false);
  const attendanceRef = useRef<HTMLElement>(null);
  function reset() {
    setReviewOnly(false);
    onReset();
  }
  function inspect() {
    setReviewOnly(true);
    attendanceRef.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
  const filteredSessions = reviewOnly
    ? sessions.filter((s) => usageReviewReason(s, asOf))
    : sessions;
  return (
    <div className="usage-report">
      <div className="report-context">
        <div>
          <strong>Penggunaan laboratorium</strong>
          <span>
            {sessions.length
              ? `${usageDate(report.start)} – ${usageDate(report.end)}`
              : "Belum ada kunjungan sesuai filter"}
          </span>
        </div>
        <button onClick={reset}>
          <RotateCcw size={14} />
          Reset filter
        </button>
      </div>
      {report.invalidRange && (
        <p className="error" role="alert">
          Tanggal akhir harus sama dengan atau setelah tanggal mulai.
        </p>
      )}
      <div className="report-metrics">
        <section>
          <span>
            <Users size={17} />
            Pengunjung unik
          </span>
          <strong>
            {report.visitors}
            <small> orang</small>
          </strong>
          <p>Dari {report.visits} kunjungan sesuai filter.</p>
        </section>
        <section>
          <span>
            <Clock size={17} />
            Rata-rata kunjungan
          </span>
          <strong>
            {report.averageMinutes === null
              ? "—"
              : usageDuration(report.averageMinutes)}
          </strong>
          <p>{report.completedCount} sesi selesai dengan waktu lengkap.</p>
        </section>
        <section>
          <span>
            <Monitor size={17} />
            Jam penggunaan PC
          </span>
          <strong>
            {(report.pcMinutes / 60).toLocaleString("id-ID", {
              maximumFractionDigits: 1,
            })}
            <small> jam</small>
          </strong>
          <p>Durasi aktual sesi PC; kunjungan tanpa PC tidak dihitung.</p>
        </section>
        <section className={report.review.length ? "report-attention" : ""}>
          <span>
            <ClipboardList size={17} />
            Sesi perlu ditinjau
          </span>
          <strong>
            {report.review.length}
            <small> sesi</small>
          </strong>
          <p>
            {report.review.length
              ? "Belum keluar dari hari sebelumnya atau waktu tidak lengkap."
              : "Tidak ada catatan waktu yang perlu ditinjau."}
          </p>
          {report.review.length > 0 && (
            <button className="text-link" onClick={inspect}>
              Periksa sesi <ArrowDown size={13} />
            </button>
          )}
        </section>
      </div>
      <section className="panel report-trend">
        <div className="panel-heading">
          <div>
            <h2>Durasi kunjungan tercatat</h2>
            <p>
              {report.bucketDays > 1
                ? `Dikelompokkan per ${report.bucketDays} hari`
                : "Per hari"}{" "}
              · satuan jam · waktu Asia/Jakarta
            </p>
          </div>
        </div>
        {report.completedCount > 0 && report.minutes > 0 ? (
          <>
            <div className="report-chart">
              <ResponsiveContainer width="100%" height={245}>
                <BarChart
                  data={report.buckets}
                  margin={{ top: 14, right: 16, left: 0, bottom: 4 }}
                  accessibilityLayer
                >
                  <CartesianGrid vertical={false} stroke="#e7edf4" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    minTickGap={24}
                  />
                  <YAxis tick={{ fontSize: 11 }} width={42} />
                  <Tooltip
                    labelFormatter={(_label, payload) =>
                      payload[0]?.payload?.period || ""
                    }
                    formatter={(value) => [
                      `${Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 })} jam`,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="pcHours"
                    name="Menggunakan PC"
                    stackId="duration"
                    fill="#487db8"
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="visitHours"
                    name="Kunjungan tanpa PC"
                    stackId="duration"
                    fill="#75a98f"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="report-chart-data">
              <summary>Lihat angka per periode</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Periode</th>
                      <th>Kunjungan</th>
                      <th>Penggunaan PC</th>
                      <th>Tanpa PC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.buckets.map((b) => (
                      <tr key={b.start}>
                        <td>{b.period}</td>
                        <td>{b.visits}</td>
                        <td>{usageDuration(b.pcMinutes)}</td>
                        <td>{usageDuration(b.visitMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <div className="report-empty">
            <Clock size={25} />
            <strong>
              {report.completedCount
                ? "Durasi tercatat masih 0 menit"
                : "Belum ada durasi selesai yang dapat ditampilkan"}
            </strong>
            <p>
              {report.completedCount
                ? "Semua sesi dengan waktu lengkap memiliki durasi 0 menit."
                : sessions.length
                  ? `${report.active} sesi masih aktif dan ${report.review.length} sesi perlu ditinjau. Sesi tanpa waktu keluar yang valid tidak masuk perhitungan durasi.`
                  : "Ubah atau reset filter untuk melihat kunjungan pada periode lain."}
            </p>
            {!sessions.length && <button onClick={reset}>Reset filter</button>}
          </div>
        )}
      </section>
      <section className="panel report-attendance" ref={attendanceRef}>
        <div className="panel-heading">
          <div>
            <h2>Riwayat presensi</h2>
            <p>
              {filteredSessions.length} sesi ditampilkan
              {reviewOnly ? " · perlu ditinjau" : ""}.
            </p>
          </div>
          <div className="row-actions">
            <button
              className={!reviewOnly ? "report-tab selected" : "report-tab"}
              aria-pressed={!reviewOnly}
              onClick={() => setReviewOnly(false)}
            >
              Semua sesi
            </button>
            <button
              className={reviewOnly ? "report-tab selected" : "report-tab"}
              aria-pressed={reviewOnly}
              onClick={() => setReviewOnly(true)}
            >
              Perlu ditinjau ({report.review.length})
            </button>
            <a className="button" href={exportURL("csv")}>
              <ArrowDownToLine size={14} />
              CSV presensi
            </a>
            <a className="button" href={exportURL("pdf")}>
              PDF presensi
            </a>
          </div>
        </div>
        {reviewOnly && (
          <p className="report-note">
            Daftar ini menyoroti waktu yang belum lengkap. Ekspor presensi tetap
            memuat semua sesi sesuai filter utama.
          </p>
        )}
        {attendanceTable(filteredSessions)}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Penggunaan per komputer</h2>
            <p>
              Diurutkan dari durasi PC tertinggi.{" "}
              {report.byPC.filter((p) => p.visits > 0).length} dari {pcs.length}{" "}
              PC memiliki kunjungan pada hasil filter.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Komputer</th>
                <th>Pengunjung unik</th>
                <th>Kunjungan</th>
                <th>Durasi selesai</th>
                <th>Perlu ditinjau</th>
                <th>Kunjungan terakhir</th>
              </tr>
            </thead>
            <tbody>
              {report.byPC.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.code}</strong>
                  </td>
                  <td>{p.visitors}</td>
                  <td>{p.visits}</td>
                  <td>{usageDuration(p.minutes)}</td>
                  <td>{p.review || "—"}</td>
                  <td>
                    {p.lastVisit
                      ? new Date(p.lastVisit).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Belum digunakan"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Riwayat peminjaman</h2>
            <p>
              {requests.length} pengajuan sesuai filter; data pemesanan terpisah
              dari durasi penggunaan aktual.
            </p>
          </div>
          <div className="row-actions">
            <a className="button" href={exportURL("csv", "requests")}>
              <ArrowDownToLine size={14} />
              CSV peminjaman
            </a>
            <a className="button" href={exportURL("pdf", "requests")}>
              PDF peminjaman
            </a>
          </div>
        </div>
        {requestTable(requests)}
      </section>
    </div>
  );
}
