"use client";
import AccountProfile from "./account-profile";
import LabScanner from "./lab-scanner";
import RemotePanel from "./remote-panel";
import Analytics from "./analytics";
import UsageReport from "./usage-report";
import { usageReviewReason } from "@/lib/usage-report";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  cloneElement,
  useId,
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactElement,
} from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
  Settings,
  FileChartColumn,
  ClipboardList,
  MapPin,
  Wifi,
} from "lucide-react";
import { labels } from "@/lib/rules";
type Lab = {
  id: string;
  code: string;
  name: string;
  description: string;
  location: string;
  active: boolean;
};
type Telemetry = {
  recordedAt: string;
  simulated: boolean;
  cpuPercent: number | null;
  ramPercent: number | null;
  gpuName: string | null;
  gpuPercent: number | null;
  gpuMemoryUsed: number | null;
  gpuMemoryTotal: number | null;
  gpuTemperature: number | null;
  gpuPower: number | null;
};
type PC = {
  id: string;
  code: string;
  name: string;
  laboratoryId: string;
  laboratory: Lab;
  description: string;
  cpu: string;
  ram: string;
  gpu: string | null;
  vram: number | null;
  status: string;
  effectiveStatus: string;
  connectivity: string;
  monitoring: boolean;
  lastHeartbeat: string | null;
  telemetry?: Telemetry[];
};
type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  userType: string;
  identity?: string;
  institution?: string;
};
type Borrow = {
  id: string;
  userId: string;
  pcId: string;
  laboratoryId: string;
  pc: PC;
  user: Person;
  startAt: string;
  endAt: string;
  purpose: string;
  status: string;
  rejectionReason: string | null;
};
type Attendance = {
  id: string;
  userId: string;
  laboratoryId: string;
  pcId: string | null;
  reservationId: string | null;
  pc: PC | null;
  user: Person;
  laboratory: Lab;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  status: string;
  purpose: string;
  correctionReason: string | null;
};
type Data = {
  serverTime: string;
  user: Person;
  labs: Lab[];
  pcs: PC[];
  requests: Borrow[];
  attendance: Attendance[];
  users: Person[];
  audits: {
    id: string;
    actor: { name: string };
    action: string;
    reason: string | null;
    createdAt: string;
  }[];
  occupancy: { id: string; pcId: string; startAt: string; endAt: string }[];
};
type FormValues = Record<string, string | boolean>;
const titles: Record<string, string> = {
  remote: "Remote PC",
  dashboard: "Ringkasan aktivitas",
  laboratorium: "Laboratorium",
  peminjaman: "Peminjaman PC",
  pengajuan: "Pengajuan peminjaman",
  "riwayat-peminjaman": "Riwayat peminjaman",
  presensi: "Presensi aktif",
  "riwayat-presensi": "Riwayat presensi",
  pc: "Data komputer",
  monitoring: "Monitoring PC",
  riwayat: "Riwayat penggunaan",
  laporan: "Riwayat & laporan",
  pengguna: "Manajemen pengguna",
  profil: "Profil saya",
};
const navItems = [
  ["dashboard", "Dasbor", LayoutDashboard],
  ["remote", "Remote PC", Monitor],
  ["laboratorium", "Laboratorium", FlaskConical],
  ["peminjaman", "Peminjaman PC", Monitor],
  ["pengajuan", "Pengajuan peminjaman", ClipboardList],
  ["pc", "Data PC", Monitor],
  ["presensi", "Presensi", Activity],
  ["monitoring", "Monitoring PC", Wifi],
  ["riwayat-peminjaman", "Riwayat peminjaman", Clock],
  ["riwayat-presensi", "Riwayat presensi", Clock],
  ["laporan", "Riwayat & laporan", FileChartColumn],
  ["pengguna", "Pengguna", Users],
  ["profil", "Profil", Settings],
] as const;
function dt(v: string | null) {
  return v
    ? new Date(v).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}
function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + value.toLowerCase()}>
      <i />
      {labels[value] || value}
    </span>
  );
}
function Empty({
  message = "Belum ada data yang sesuai filter.",
}: {
  message?: string;
}) {
  return (
    <div className="empty">
      <ClipboardList size={30} />
      <p>{message}</p>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children as ReactElement<{ id: string }>, { id })}
    </div>
  );
}
export default function Workspace({
  section,
  scanId,
}: {
  section: string;
  scanId?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null),
    [failure, setFailure] = useState(""),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [editing, setEditing] = useState<Lab | PC | null>(null),
    [search, setSearch] = useState(""),
    [labFilter, setLabFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [pcFilter, setPcFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [calendarDate, setCalendarDate] = useState(
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
    ),
    [qr, setQr] = useState(""),
    [qrLab, setQrLab] = useState(""),
    [deviceSecret, setDeviceSecret] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = useForm<FormValues>();
  const watched = useWatch({ control });
  const dialog = useRef<HTMLDialogElement>(null);
  const scanOpened = useRef(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      if (r.status === 401) {
        router.push("/login");
        return;
      }
      if (!r.ok) throw new Error();
      const next = await r.json();
      setData(next);
      setFailure("");
    } catch {
      setFailure("Tidak dapat memuat data. Periksa koneksi Anda.");
    }
  }, [router]);
  useEffect(() => {
    if (!data || scanOpened.current) return;
    queueMicrotask(() => {
      const token = new URLSearchParams(location.search).get("qr");
      if (token && !scanOpened.current) {
        scanOpened.current = true;
        try {
          const payload = JSON.parse(
            atob(token.split(".")[0].replaceAll("-", "+").replaceAll("_", "/")),
          );
          const laboratoryId =
            payload.kind === "lab"
              ? payload.laboratoryId
              : data.pcs.find((p: PC) => p.id === payload.pcId)?.laboratoryId;
          if (laboratoryId && data.labs.some((l) => l.id === laboratoryId)) {
            const today = new Date(data.serverTime).toLocaleDateString(
              "en-CA",
              { timeZone: "Asia/Jakarta" },
            );
            const session = data.attendance.find(
              (a) =>
                a.laboratoryId === laboratoryId &&
                new Date(a.checkIn).toLocaleDateString("en-CA", {
                  timeZone: "Asia/Jakarta",
                }) === today,
            );
            const reservation = data.requests.find(
              (r) =>
                r.laboratoryId === laboratoryId &&
                r.status === "APPROVED" &&
                new Date(r.startAt) <= new Date(data.serverTime) &&
                new Date(r.endAt) > new Date(data.serverTime),
            );
            reset({
              laboratoryId,
              purpose:
                session?.purpose ||
                reservation?.purpose ||
                "Kegiatan laboratorium",
              reservationId: session?.reservationId || reservation?.id || "",
            });
            setModal("checkin");
          }
        } catch {
          toast.error("Kode QR tidak valid.");
        }
      }
    });
  }, [data, reset]);
  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = setInterval(() => void load(), 20000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  const getQR = useCallback(async (id: string) => {
    const r = await fetch("/api/qr?lab=" + id);
    const j = await r.json();
    if (r.ok) setQr(j.image);
    else toast.error(j.error);
  }, []);
  useEffect(() => {
    if (!qrLab) return;
    queueMicrotask(() => void getQR(qrLab));
    const timer = setInterval(() => void getQR(qrLab), 90000);
    return () => clearInterval(timer);
  }, [qrLab, getQR]);
  async function act(action: string, values: Record<string, unknown>) {
    const r = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...values }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    toast.success(
      action === "checkin" && values.qr
        ? j.result?.status === "ACTIVE"
          ? "Jam masuk pertama berhasil dicatat."
          : "Jam keluar terakhir berhasil dicatat; jam masuk tetap."
        : "Perubahan berhasil disimpan.",
    );
    await load();
    return j.result;
  }
  function open(name: string, item?: Lab | PC) {
    setEditing(item || null);
    reset(
      item
        ? ({
            ...item,
            vram: "vram" in item ? String(item.vram || "") : "",
          } as FormValues)
        : {},
    );
    setDeviceSecret("");
    setModal(name);
  }
  async function safe(action: string, values: Record<string, unknown>) {
    try {
      return await act(action, values);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operasi gagal.");
    }
  }
  async function submit(values: FormValues) {
    try {
      const v: Record<string, unknown> = { ...values };
      const action = modal;
      if (action === "reserve") {
        v.startAt = new Date(
          String(values.startAt) + ":00+07:00",
        ).toISOString();
        v.endAt = new Date(String(values.endAt) + ":00+07:00").toISOString();
      }
      if (action === "lab") {
        v.active = Boolean(values.active);
        if (editing) v.id = editing.id;
      }
      if (action === "pc") {
        v.vram = values.vram ? Number(values.vram) : null;
        v.gpu = values.gpu || null;
        v.monitoring = Boolean(values.monitoring);
        if (editing) v.id = editing.id;
      }
      if (action === "checkin") {
        if (!v.reservationId) delete v.reservationId;
        if (!v.targetUserId) delete v.targetUserId;
        const token = new URLSearchParams(location.search).get("qr");
        if (token) v.qr = token;
      }
      if (action === "device") {
        v.simulated = values.simulated === "true";
        const result = await act("device", v);
        setDeviceSecret(result.secret);
        return;
      }
      await act(action || "", v);
      setModal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Isian tidak valid.");
    }
  }
  if (!data)
    return (
      <main className="loading">
        <FlaskConical size={36} />
        <h1>Menyiapkan ruang kerja…</h1>
        {failure && (
          <>
            <p role="alert">{failure}</p>
            <button onClick={load}>Coba lagi</button>
          </>
        )}
      </main>
    );
  const { user, labs, pcs, requests, attendance, serverTime } = data,
    admin = user.role === "LAB_ADMIN",
    staff = user.role !== "USER";
  const permitted = admin
    ? navItems.filter(
        (n) => !["riwayat-peminjaman", "riwayat-presensi"].includes(n[0]),
      )
    : staff
      ? navItems.filter((n) =>
          [
            "dashboard",
            "remote",
            "laboratorium",
            "monitoring",
            "riwayat",
            "laporan",
            "profil",
          ].includes(n[0]),
        )
      : navItems.filter((n) =>
          [
            "dashboard",
            "remote",
            "peminjaman",
            "riwayat-peminjaman",
            "presensi",
            "riwayat-presensi",
            "profil",
          ].includes(n[0]),
        );
  const authorized = permitted.some((n) => n[0] === section);
  const borrowingLabs = labs.filter((l) => l.code !== "VR");
  const borrowingPCs = pcs.filter((p) => p.laboratory.code !== "VR");
  const filteredPC = pcs.filter(
    (p) =>
      (!labFilter || p.laboratoryId === labFilter) &&
      (!search ||
        (p.code + " " + p.name).toLowerCase().includes(search.toLowerCase())),
  );
  const selectedRequests = requests.filter(
    (r) =>
      (!labFilter || r.laboratoryId === labFilter) &&
      (!statusFilter || r.status === statusFilter) &&
      (!pcFilter || r.pcId === pcFilter) &&
      (!typeFilter || r.user.userType === typeFilter) &&
      (!from || new Date(r.startAt) >= new Date(from + "T00:00:00+07:00")) &&
      (!to || new Date(r.startAt) <= new Date(to + "T23:59:59.999+07:00")) &&
      (!search ||
        [r.user.name, r.pc.code, r.purpose].some((v) =>
          v.toLowerCase().includes(search.toLowerCase()),
        )),
  );
  const selectedAttendance = attendance.filter(
    (s) =>
      (!labFilter || s.laboratoryId === labFilter) &&
      (!pcFilter || s.pcId === pcFilter) &&
      (!typeFilter || s.user.userType === typeFilter) &&
      (!from || new Date(s.checkIn) >= new Date(from + "T00:00:00+07:00")) &&
      (!to || new Date(s.checkIn) <= new Date(to + "T23:59:59.999+07:00")) &&
      (!statusFilter ||
        requests.some(
          (r) => r.id === s.reservationId && r.status === statusFilter,
        )) &&
      (!search ||
        [s.user.name, s.pc?.code || "", s.purpose].some((v) =>
          v.toLowerCase().includes(search.toLowerCase()),
        )),
  );
  const pending = requests.filter((r) => r.status === "PENDING");
  const filters = (
    <div className="filters">
      <div className="search">
        <Search size={17} />
        <input
          aria-label="Cari data"
          placeholder="Cari pengguna, PC, atau aktivitas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <select
        aria-label="Filter laboratorium"
        value={labFilter}
        onChange={(e) => {
          setLabFilter(e.target.value);
          setPcFilter("");
        }}
      >
        <option value="">Semua laboratorium</option>
        {(section === "peminjaman" ? borrowingLabs : labs).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      {["laporan", "riwayat", "pengajuan", "riwayat-peminjaman"].includes(
        section,
      ) && (
        <>
          <select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua status peminjaman</option>
            {[
              "PENDING",
              "APPROVED",
              "REJECTED",
              "CANCELLED",
              "COMPLETED",
              "EXPIRED",
            ].map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
          <label className="date-filter">
            Dari tanggal
            <input
              aria-label="Tanggal mulai"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="date-filter">
            Sampai tanggal
            <input
              aria-label="Tanggal akhir"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </>
      )}
    </div>
  );
  function requestTable(rows: Borrow[]) {
    return rows.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pengguna / tujuan</th>
              <th>Komputer</th>
              <th>Jadwal · WIB</th>
              <th>Status</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.user.name}</strong>
                  <small>{r.purpose}</small>
                  {r.rejectionReason && (
                    <small className="error">Alasan: {r.rejectionReason}</small>
                  )}
                </td>
                <td>
                  <span className="pc-inline">
                    <Monitor size={16} />
                    {r.pc.code}
                  </span>
                  <small>
                    {labs.find((l) => l.id === r.laboratoryId)?.name}
                  </small>
                </td>
                <td>
                  {dt(r.startAt)}
                  <small>s.d. {dt(r.endAt)}</small>
                </td>
                <td>
                  <Badge value={r.status} />
                </td>
                <td>
                  <div className="row-actions">
                    {admin &&
                      r.status === "PENDING" &&
                      r.userId !== user.id && (
                        <>
                          <button
                            className="small primary"
                            onClick={() =>
                              safe("review", { id: r.id, approve: true })
                            }
                          >
                            Setujui
                          </button>
                          <button
                            className="small danger"
                            onClick={() => {
                              reset({ id: r.id, approve: false });
                              setModal("review");
                            }}
                          >
                            Tolak
                          </button>
                        </>
                      )}
                    {r.userId === user.id &&
                      ["PENDING", "APPROVED"].includes(r.status) &&
                      new Date(r.startAt) > new Date() && (
                        <button
                          className="small"
                          onClick={() => {
                            if (confirm("Batalkan pengajuan ini?"))
                              void safe("cancel", { id: r.id });
                          }}
                        >
                          Batalkan
                        </button>
                      )}
                    {r.userId === user.id &&
                      r.status === "APPROVED" &&
                      new Date(r.startAt) <= new Date() &&
                      new Date(r.endAt) > new Date() && (
                        <button
                          className="small primary"
                          onClick={() => {
                            if (!admin) {
                              router.push("/app/presensi");
                              return;
                            }
                            reset({
                              laboratoryId: r.laboratoryId,
                              reservationId: r.id,
                              purpose: r.purpose,
                            });
                            setModal("checkin");
                          }}
                        >
                          {admin ? "Masuk lab" : "Pindai QR lab"}
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty message="Tidak ada pengajuan peminjaman untuk ditampilkan." />
    );
  }
  function attendanceTable(rows: Attendance[]) {
    return rows.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pengguna / aktivitas</th>
              <th>Laboratorium</th>
              <th>Masuk · WIB</th>
              <th>Durasi</th>
              <th>Status</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.user.name}</strong>
                  <small>{s.purpose}</small>
                  {section === "laporan" &&
                    usageReviewReason(s, serverTime) && (
                      <small className="report-row-warning">
                        {usageReviewReason(s, serverTime)}
                      </small>
                    )}
                  {s.correctionReason && (
                    <small>Koreksi: {s.correctionReason}</small>
                  )}
                </td>
                <td>
                  {s.laboratory.name}
                  <small>{s.pc?.code || "Kunjungan tanpa PC"}</small>
                </td>
                <td>
                  {dt(s.checkIn)}
                  <small>Keluar: {dt(s.checkOut)}</small>
                </td>
                <td>
                  {s.durationMinutes === null
                    ? "—"
                    : s.durationMinutes + " menit"}
                </td>
                <td>
                  <Badge value={s.status} />
                </td>
                <td>
                  {s.status === "ACTIVE" && (
                    <div className="row-actions">
                      {s.userId === user.id && !staff && (
                        <Link className="text-link" href="/app/presensi">
                          Pindai QR untuk keluar
                        </Link>
                      )}
                      {s.userId === user.id && admin && (
                        <button
                          className="small primary"
                          onClick={() => safe("checkout", { id: s.id })}
                        >
                          Keluar
                        </button>
                      )}
                      {admin && (
                        <button
                          className="small"
                          onClick={() => {
                            reset({ id: s.id });
                            setModal("checkout");
                          }}
                        >
                          Koreksi sesi
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty message="Tidak ada sesi presensi untuk ditampilkan." />
    );
  }
  const exportURL = (format: string, kind = "attendance") =>
    "/api/reports?" +
    new URLSearchParams({
      format,
      kind,
      q: search,
      lab: labFilter,
      pc: pcFilter,
      type: typeFilter,
      status: statusFilter,
      from,
      to,
    }).toString();
  return (
    <div
      className={
        "shell reference-layout operations-layout " +
        (section === "dashboard" ? "board-page" : "")
      }
    >
      {mobile && (
        <button
          className="navigation-veil"
          aria-label="Tutup menu navigasi"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={mobile ? "sidebar expanded" : "sidebar"}>
        {mobile && (
          <button
            className="navigation-close"
            aria-label="Tutup navigasi"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        )}
        <Link className="brand" href="/app/dashboard">
          <span className="brand-icon">
            <FlaskConical size={23} />
          </span>
          LabTrack<span className="brand-dot">.</span>
        </Link>
        <div className="institution">
          UNIVERSITAS KRISTEN PETRA
          <span>
            {staff
              ? "Portal pengelola laboratorium"
              : "Portal mahasiswa · AI & VR"}
          </span>
        </div>
        <nav aria-label="Navigasi portal">
          {[
            { title: "UTAMA", keys: ["dashboard", "laboratorium"] },
            {
              title: "LAYANAN",
              keys: ["peminjaman", "remote", "pengajuan", "presensi"],
            },
            { title: "PERANGKAT", keys: ["pc", "monitoring"] },
            {
              title: "RIWAYAT & LAPORAN",
              keys: [
                "riwayat-peminjaman",
                "riwayat-presensi",
                "riwayat",
                "laporan",
              ],
            },
            { title: "AKUN", keys: ["pengguna", "profil"] },
          ].map((group) => {
            const items = permitted.filter(([key]) => group.keys.includes(key));
            return (
              items.length > 0 && (
                <div className="nav-group" key={group.title}>
                  <div className="nav-label">{group.title}</div>
                  {items.map(([key, title, Icon]) => (
                    <Link
                      key={key}
                      href={"/app/" + key}
                      className={section === key ? "selected" : ""}
                      aria-current={section === key ? "page" : undefined}
                      onClick={() => setMobile(false)}
                    >
                      <Icon size={17} />
                      {title}
                      {key === "pengajuan" && pending.length > 0 && (
                        <span className="nav-count">{pending.length}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )
            );
          })}
        </nav>
        <div className="sidebar-labs">
          <div className="nav-label">LABORATORIUM</div>
          {labs.map((l) => {
            const total = pcs.filter((p) => p.laboratoryId === l.id).length,
              available = pcs.filter(
                (p) =>
                  p.laboratoryId === l.id && p.effectiveStatus === "AVAILABLE",
              ).length;
            return (
              <Link key={l.id} href="/app/laboratorium" className="sidebar-lab">
                <strong>
                  <span className={"lab-mark " + l.code.toLowerCase()}>
                    {l.code}
                  </span>
                  {l.name}
                </strong>
                <div className="capacity-track">
                  <span
                    style={{
                      width: (total ? (available / total) * 100 : 0) + "%",
                    }}
                  />
                </div>
                <small>
                  {available} dari {total} PC tersedia
                </small>
              </Link>
            );
          })}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-role">
            <span className="dot green" />
            {labels[user.role]}
          </div>
          <button
            className="logout"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={17} />
            Keluar akun
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="Buka navigasi"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            LabTrack
            <ChevronRight size={14} />
            <strong>
              {!staff && section === "dashboard"
                ? "Dasbor saya"
                : section === "profil"
                  ? !staff
                    ? "Profil mahasiswa"
                    : admin
                      ? "Profil pengelola"
                      : "Profil kepala laboratorium"
                  : titles[section]}
            </strong>
          </div>
          <div className="account">
            <span className="avatar">
              {user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{labels[user.role]}</small>
            </div>
          </div>
        </header>
        <main className="content">
          {failure && (
            <p role="alert" className="error">
              {failure}
            </p>
          )}
          {!authorized ? (
            <section className="panel">
              <h1>Akses dibatasi</h1>
              <p>Peran Anda tidak memiliki akses ke halaman ini.</p>
            </section>
          ) : (
            <>
              <div className="page-heading">
                <span className="page-icon" aria-hidden="true">
                  {section === "dashboard" ? (
                    <LayoutDashboard size={24} />
                  ) : section === "profil" ? (
                    <Users size={24} />
                  ) : (
                    <FlaskConical size={24} />
                  )}
                </span>
                <div>
                  <div className="eyebrow">
                    LABTRACK /{" "}
                    {staff ? "PENGELOLAAN LABORATORIUM" : "RUANG PENGGUNA"}
                  </div>
                  <h1>
                    {section === "dashboard"
                      ? staff
                        ? "Aktivitas laboratorium"
                        : "Dasbor saya"
                      : section === "profil"
                        ? !staff
                          ? "Profil mahasiswa"
                          : admin
                            ? "Profil pengelola"
                            : "Profil kepala laboratorium"
                        : titles[section]}
                  </h1>
                  <p>
                    {section === "dashboard"
                      ? staff
                        ? "Ringkasan peminjaman PC dan kehadiran laboratorium."
                        : "Lihat pemesanan PC dan catatan kehadiran Anda sendiri."
                      : {
                          remote:
                            "Pengajuan akses jarak jauh, surat izin, dan persetujuan.",
                          laboratorium:
                            "Informasi ruang, ketersediaan perangkat, dan QR presensi.",
                          peminjaman:
                            "Pilih PC Lab AI dan ajukan jadwal peminjaman.",
                          pengajuan:
                            "Tinjau jadwal dan keputusan pengajuan peminjaman.",
                          pc: "Inventaris dan status operasional komputer.",
                          presensi:
                            "Pindai QR laboratorium untuk mencatat masuk dan keluar.",
                          monitoring:
                            "Koneksi dan metrik perangkat yang terhubung.",
                          profil: "Identitas dan akses akun Anda.",
                          pengguna: "Daftar akun dan hak akses portal.",
                          laporan:
                            "Rekap peminjaman dan presensi laboratorium.",
                        }[section] ||
                        "Catatan penggunaan dan aktivitas laboratorium."}
                  </p>
                </div>
                <div className="heading-actions">
                  {section === "dashboard" && staff ? (
                    <div className="heading-search">
                      <Search size={16} />
                      <input
                        aria-label="Cari aktivitas"
                        placeholder="Cari aktivitas…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  ) : (
                    <button aria-label="Perbarui data" onClick={load}>
                      <RefreshCw size={16} />
                      <span>Perbarui</span>
                    </button>
                  )}
                  {(section === "peminjaman" ||
                    (section === "dashboard" && user.role !== "HEAD_LAB")) && (
                    <button className="primary" onClick={() => open("reserve")}>
                      <Plus size={16} />
                      Ajukan peminjaman
                    </button>
                  )}
                  {section === "laboratorium" && admin && (
                    <button className="primary" onClick={() => open("lab")}>
                      <Plus size={17} />
                      Tambah laboratorium
                    </button>
                  )}
                  {section === "pc" && admin && (
                    <button className="primary" onClick={() => open("pc")}>
                      <Plus size={17} />
                      Tambah PC
                    </button>
                  )}
                  {section === "presensi" && admin && (
                    <button className="primary" onClick={() => open("checkin")}>
                      <Plus size={17} />
                      Bantu check-in
                    </button>
                  )}
                  {section === "pengguna" && admin && (
                    <button
                      className="primary"
                      onClick={() => open("createUser")}
                    >
                      <Plus size={17} />
                      Tambah pengguna
                    </button>
                  )}
                </div>
              </div>
              {section === "remote" && (
                <RemotePanel user={user} pcs={pcs} onChanged={load} />
              )}
              {section === "dashboard" && !staff && (
                <>
                  <div className="student-summary metric-grid">
                    <div>
                      <span className="metric-symbol amber">
                        <ClipboardList size={23} />
                      </span>
                      <strong>
                        {requests.filter((r) => r.status === "PENDING").length}
                      </strong>
                      <span>Pengajuan menunggu</span>
                    </div>
                    <div>
                      <span className="metric-symbol blue">
                        <Monitor size={23} />
                      </span>
                      <strong>
                        {requests.filter((r) => r.status === "APPROVED").length}
                      </strong>
                      <span>Reservasi disetujui</span>
                    </div>
                    <div>
                      <span className="metric-symbol green">
                        <Activity size={23} />
                      </span>
                      <strong>
                        {attendance.filter((s) => s.status === "ACTIVE").length}
                      </strong>
                      <span>Presensi aktif</span>
                    </div>
                  </div>
                  <section className="panel" data-testid="personal-attendance">
                    <div className="panel-heading">
                      <div>
                        <h2>Presensi saya saat ini</h2>
                        <p>
                          Pindai kembali QR laboratorium untuk mencatat waktu
                          keluar.
                        </p>
                      </div>
                      <Link className="text-link" href="/app/presensi">
                        Pindai QR lab <ArrowRight size={14} />
                      </Link>
                    </div>
                    {attendanceTable(
                      attendance.filter((s) => s.status === "ACTIVE"),
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Pemesanan saya yang berjalan</h2>
                        <p>
                          Pengajuan menunggu dan reservasi disetujui milik Anda.
                        </p>
                      </div>
                      <Link className="text-link" href="/app/peminjaman">
                        Pesan PC <Plus size={15} />
                      </Link>
                    </div>
                    {requestTable(
                      requests.filter((r) =>
                        ["PENDING", "APPROVED"].includes(r.status),
                      ),
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Riwayat pemesanan terakhir saya</h2>
                      <Link
                        className="text-link"
                        href="/app/riwayat-peminjaman"
                      >
                        Lihat semua <ArrowRight size={15} />
                      </Link>
                    </div>
                    {requestTable(
                      requests
                        .filter(
                          (r) => !["PENDING", "APPROVED"].includes(r.status),
                        )
                        .slice(0, 5),
                    )}
                  </section>
                </>
              )}
              {section === "dashboard" && staff && (
                <>
                  <div className="metric-grid">
                    <Link className="metric-card" href="/app/pc">
                      <span className="metric-symbol blue">
                        <Monitor size={23} />
                      </span>
                      <strong>
                        {
                          filteredPC.filter(
                            (p) => p.effectiveStatus === "AVAILABLE",
                          ).length
                        }
                        <small> / {filteredPC.length}</small>
                      </strong>
                      <span>PC tersedia</span>
                      <small>Status perangkat saat ini</small>
                    </Link>
                    <Link className="metric-card" href="/app/pengajuan">
                      <span className="metric-symbol amber">
                        <ClipboardList size={23} />
                      </span>
                      <strong>
                        {
                          selectedRequests.filter((r) => r.status === "PENDING")
                            .length
                        }
                      </strong>
                      <span>Pengajuan menunggu</span>
                      <small>Menunggu keputusan administrator</small>
                    </Link>
                    <Link className="metric-card" href="/app/presensi">
                      <span className="metric-symbol green">
                        <Users size={23} />
                      </span>
                      <strong>
                        {
                          selectedAttendance.filter(
                            (s) => s.status === "ACTIVE",
                          ).length
                        }
                      </strong>
                      <span>Mahasiswa di laboratorium</span>
                      <small>Sesi presensi yang masih aktif</small>
                    </Link>
                  </div>
                  <div className="dashboard-filter">
                    <span>
                      <span className="dot green" /> Data diperbarui otomatis
                    </span>
                    <select
                      aria-label="Filter laboratorium"
                      value={labFilter}
                      onChange={(e) => setLabFilter(e.target.value)}
                    >
                      <option value="">Semua laboratorium</option>
                      {labs.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="operations-grid">
                    <section className="panel lab-availability">
                      <div className="panel-heading">
                        <h2>
                          <Monitor size={16} /> Ketersediaan perangkat
                        </h2>
                      </div>
                      {labs
                        .filter((l) => !labFilter || l.id === labFilter)
                        .map((l) => {
                          const devices = pcs.filter(
                            (p) => p.laboratoryId === l.id,
                          );
                          const available = devices.filter(
                            (p) => p.effectiveStatus === "AVAILABLE",
                          ).length;
                          return (
                            <div className="availability-row" key={l.id}>
                              <div>
                                <strong>{l.name}</strong>
                                <span>
                                  {available} / {devices.length}
                                </span>
                              </div>
                              <div
                                className="availability-bar"
                                role="img"
                                aria-label={`${available} dari ${devices.length} PC tersedia`}
                              >
                                <span
                                  style={{
                                    width: `${devices.length ? (available / devices.length) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <small>
                                {l.code === "VR"
                                  ? "Tidak untuk peminjaman PC"
                                  : "PC tersedia untuk diajukan"}
                              </small>
                            </div>
                          );
                        })}
                      <Link
                        className="panel-bottom-link"
                        href="/app/laboratorium"
                      >
                        Lihat laboratorium <ArrowRight size={14} />
                      </Link>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>
                          <ClipboardList size={16} /> Pengajuan peminjaman
                          terbaru
                        </h2>
                        <Link className="text-link" href="/app/pengajuan">
                          Lihat semua <ArrowRight size={14} />
                        </Link>
                      </div>
                      {requestTable(
                        selectedRequests
                          .filter((r) =>
                            ["PENDING", "APPROVED"].includes(r.status),
                          )
                          .slice(0, 5),
                      )}
                    </section>
                    <section className="panel recent-log">
                      <div className="panel-heading">
                        <h2>
                          <Clock size={16} /> Aktivitas terbaru
                        </h2>
                      </div>
                      {data.audits.length ? (
                        <ol>
                          {data.audits.slice(0, 5).map((a) => (
                            <li key={a.id}>
                              <strong>
                                {labels[a.action] ||
                                  a.action.replaceAll("_", " ").toLowerCase()}
                              </strong>
                              <span>{a.actor?.name || "Sistem"}</span>
                              <small>{dt(a.createdAt)} WIB</small>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="quiet-empty">
                          Belum ada aktivitas tercatat.
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>
                          <Activity size={16} /> Kehadiran aktif
                        </h2>
                        <Link className="text-link" href="/app/presensi">
                          Buka presensi <ArrowRight size={14} />
                        </Link>
                      </div>
                      {attendanceTable(
                        selectedAttendance.filter((s) => s.status === "ACTIVE"),
                      )}
                    </section>
                  </div>
                </>
              )}
              {section === "dashboard" && staff && (
                <details className="dashboard-analytics">
                  <summary>
                    <FileChartColumn size={17} />
                    Statistik & monitoring laboratorium{" "}
                    <ChevronRight size={16} />
                  </summary>
                  <Analytics
                    asOf={data.serverTime}
                    requests={selectedRequests}
                    attendance={selectedAttendance}
                    pcs={filteredPC}
                  />
                </details>
              )}
              {section === "laboratorium" && (
                <div className="lab-grid">
                  {labs.map((l) => (
                    <section className="panel lab-card" key={l.id}>
                      <div className={"lab-cover " + l.code.toLowerCase()}>
                        <FlaskConical size={58} />
                        <span>{l.code} LAB</span>
                      </div>
                      <div className="lab-card-body">
                        <Badge value={l.active ? "AVAILABLE" : "UNAVAILABLE"} />
                        <h2>{l.name}</h2>
                        <p>{l.description}</p>
                        <p className="location">
                          <MapPin size={16} />
                          {l.location}
                        </p>
                        <div className="lab-pcs">
                          {pcs
                            .filter((p) => p.laboratoryId === l.id)
                            .map((p) => (
                              <div key={p.id}>
                                <Monitor size={17} />
                                <strong>{p.code}</strong>
                                <Badge value={p.effectiveStatus} />
                              </div>
                            ))}
                        </div>
                        <div className="row-actions">
                          {user.role !== "HEAD_LAB" && l.code !== "VR" && (
                            <button
                              className="primary"
                              onClick={() => {
                                reset({ laboratoryId: l.id });
                                setModal("reserve");
                              }}
                            >
                              Pilih komputer
                              <ArrowRight size={15} />
                            </button>
                          )}
                          {admin && (
                            <>
                              <button
                                onClick={() => {
                                  setQr("");
                                  setQrLab(l.id);
                                  setModal("qr");
                                }}
                                disabled={!l.active}
                              >
                                QR presensi lab
                              </button>
                              <button onClick={() => open("lab", l)}>
                                Ubah
                              </button>
                              <button
                                className="danger"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Hapus laboratorium? Data yang memiliki riwayat tidak dapat dihapus.",
                                    )
                                  )
                                    void safe("deleteLab", { id: l.id });
                                }}
                              >
                                Hapus
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              )}
              {["peminjaman", "pengajuan", "riwayat-peminjaman"].includes(
                section,
              ) && (
                <>
                  {filters}
                  {section === "peminjaman" && !staff && (
                    <>
                      {" "}
                      <div className="panel-heading">
                        <div>
                          <h2>Pilih komputer Anda</h2>
                          <p>
                            Status operasional saat ini. Jadwal diperiksa
                            kembali saat pengajuan.
                          </p>
                        </div>
                        <Link className="text-link" href="/app/peminjaman">
                          Kalender jadwal <ArrowRight size={15} />
                        </Link>
                      </div>
                      <div className="student-pcs">
                        {borrowingPCs.map((p) => (
                          <article className="student-pc" key={p.id}>
                            <div className="pc-card-head">
                              <span className="pc-symbol">
                                <Monitor size={25} />
                              </span>
                              <Badge value={p.effectiveStatus} />
                            </div>
                            <small>{p.laboratory.name}</small>
                            <h3>{p.code}</h3>
                            <p>
                              {p.gpu || "Komputer non-GPU"}
                              <br />
                              {p.cpu} · {p.ram}
                            </p>
                            <button
                              disabled={[
                                "MAINTENANCE",
                                "UNAVAILABLE",
                                "REMOTE",
                              ].includes(p.status)}
                              onClick={() => {
                                reset({
                                  pcId: p.id,
                                  laboratoryId: p.laboratoryId,
                                });
                                setModal("reserve");
                              }}
                            >
                              {[
                                "MAINTENANCE",
                                "UNAVAILABLE",
                                "REMOTE",
                              ].includes(p.status)
                                ? "Tidak tersedia"
                                : "Pilih jadwal"}{" "}
                              <ArrowRight size={16} />
                            </button>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          {section === "pengajuan"
                            ? "Daftar pengajuan"
                            : "Pengajuan saya"}
                        </h2>
                        <p>
                          Persetujuan hanya memblokir jadwal yang disetujui.
                        </p>
                      </div>
                      <span className="subtle-pill">
                        {selectedRequests.length} pengajuan
                      </span>
                    </div>
                    {requestTable(selectedRequests)}
                  </section>
                  {section === "peminjaman" && (
                    <section className="panel calendar-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Kalender ketersediaan PC</h2>
                          <p>
                            Jadwal dalam WIB · biru menunjukkan reservasi
                            disetujui.
                          </p>
                        </div>
                        <input
                          aria-label="Tanggal kalender"
                          type="date"
                          value={calendarDate}
                          onChange={(e) => setCalendarDate(e.target.value)}
                        />
                      </div>
                      <div className="calendar-scroll">
                        <div className="calendar">
                          <div className="calendar-head">
                            <span>Komputer</span>
                            {Array.from({ length: 12 }, (_, i) => (
                              <span key={i}>
                                {String(i + 7).padStart(2, "0")}.00
                              </span>
                            ))}
                          </div>
                          {filteredPC
                            .filter((p) => p.laboratory.code !== "VR")
                            .map((p) => (
                              <div key={p.id} className="calendar-row">
                                <strong>
                                  {p.code}
                                  <small>{labels[p.effectiveStatus]}</small>
                                </strong>
                                {Array.from({ length: 12 }, (_, i) => {
                                  const start = new Date(
                                      calendarDate +
                                        "T" +
                                        String(i + 7).padStart(2, "0") +
                                        ":00:00+07:00",
                                    ),
                                    end = new Date(+start + 3600000);
                                  const busy = data.occupancy.some(
                                    (r) =>
                                      r.pcId === p.id &&
                                      new Date(r.startAt) < end &&
                                      new Date(r.endAt) > start,
                                  );
                                  const pendingHere = requests.some(
                                    (r) =>
                                      r.pcId === p.id &&
                                      r.status === "PENDING" &&
                                      new Date(r.startAt) < end &&
                                      new Date(r.endAt) > start,
                                  );
                                  const state = [
                                    "REMOTE",
                                    "MAINTENANCE",
                                    "UNAVAILABLE",
                                  ].includes(p.status)
                                    ? "MAINTENANCE"
                                    : busy
                                      ? "APPROVED"
                                      : pendingHere
                                        ? "PENDING"
                                        : "AVAILABLE";
                                  return (
                                    <button
                                      key={i}
                                      className={"slot " + state.toLowerCase()}
                                      aria-label={
                                        p.code +
                                        " " +
                                        dt(start.toISOString()) +
                                        " " +
                                        labels[state]
                                      }
                                      onClick={() => {
                                        reset({
                                          pcId: p.id,
                                          startAt:
                                            calendarDate +
                                            "T" +
                                            String(i + 7).padStart(2, "0") +
                                            ":00",
                                          endAt:
                                            calendarDate +
                                            "T" +
                                            String(i + 8).padStart(2, "0") +
                                            ":00",
                                        });
                                        setModal("reserve");
                                      }}
                                      disabled={state === "MAINTENANCE" || busy}
                                    />
                                  );
                                })}
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="legend">
                        {[
                          "AVAILABLE",
                          "PENDING",
                          "APPROVED",
                          "IN_USE",
                          "REMOTE",
                          "MAINTENANCE",
                          "COMPLETED",
                        ].map((s) => (
                          <Badge key={s} value={s} />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
              {section === "presensi" && <LabScanner />}
              {["presensi", "riwayat-presensi"].includes(section) && (
                <>
                  {filters}
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>
                        {section === "presensi"
                          ? "Sesi berlangsung"
                          : "Riwayat kunjungan"}
                      </h2>
                    </div>
                    {attendanceTable(
                      section === "presensi"
                        ? selectedAttendance.filter(
                            (s) => s.status === "ACTIVE",
                          )
                        : selectedAttendance,
                    )}
                  </section>
                </>
              )}
              {["pc", "monitoring"].includes(section) && (
                <>
                  {filters}
                  <div className="pc-grid">
                    {filteredPC.map((p) => {
                      const t = p.telemetry?.[0];
                      return (
                        <section className="panel pc-card" key={p.id}>
                          <div className="pc-card-head">
                            <span className="pc-symbol">
                              <Monitor size={27} />
                            </span>
                            <Badge value={p.effectiveStatus} />
                          </div>
                          <h2>{p.code}</h2>
                          <p>
                            {p.name} · {p.laboratory.name}
                          </p>
                          <div className="specs">
                            <span>
                              Prosesor<strong>{p.cpu}</strong>
                            </span>
                            <span>
                              Memori<strong>{p.ram}</strong>
                            </span>
                            <span>
                              GPU<strong>{p.gpu || "Tidak tersedia"}</strong>
                            </span>
                            <span>
                              VRAM
                              <strong>
                                {p.vram ? p.vram + " MB" : "Tidak tersedia"}
                              </strong>
                            </span>
                          </div>
                          <div className="connectivity">
                            <Badge value={p.connectivity} />
                            <small>Heartbeat: {dt(p.lastHeartbeat)}</small>
                          </div>
                          {section === "monitoring" && (
                            <>
                              <div className="telemetry-title">
                                <strong>Telemetri perangkat</strong>
                                {t?.simulated && (
                                  <span className="simulation">SIMULASI</span>
                                )}
                              </div>
                              {!t ? (
                                <p className="muted">
                                  Belum ada data perangkat. Nilai metrik tidak
                                  tersedia.
                                </p>
                              ) : (
                                <div className="metrics">
                                  {[
                                    ["CPU", t.cpuPercent, "%"],
                                    ["RAM", t.ramPercent, "%"],
                                    ["GPU", t.gpuPercent, "%"],
                                    ["Suhu GPU", t.gpuTemperature, "°C"],
                                    ["Daya GPU", t.gpuPower, " W"],
                                    ["VRAM terpakai", t.gpuMemoryUsed, " MB"],
                                    ["VRAM total", t.gpuMemoryTotal, " MB"],
                                  ].map(([n, v, unit]) => (
                                    <div key={String(n)}>
                                      <small>{n}</small>
                                      <strong>
                                        {v === null || v === undefined
                                          ? "Tidak tersedia"
                                          : Number(v).toFixed(1) + unit}
                                      </strong>
                                    </div>
                                  ))}
                                  <small className="metric-time">
                                    Pembaruan: {dt(t.recordedAt)}
                                  </small>
                                </div>
                              )}
                            </>
                          )}
                          {admin && (
                            <div className="row-actions">
                              <button
                                className="small"
                                onClick={() => open("pc", p)}
                              >
                                Ubah PC
                              </button>

                              <button
                                className="small danger"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Hapus PC? PC yang memiliki riwayat tidak dapat dihapus.",
                                    )
                                  )
                                    void safe("deletePC", { id: p.id });
                                }}
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </>
              )}
              {["laporan", "riwayat"].includes(section) && (
                <>
                  {filters}
                  <div className="filters">
                    <select
                      aria-label="Filter PC"
                      value={pcFilter}
                      onChange={(e) => setPcFilter(e.target.value)}
                    >
                      <option value="">Semua PC</option>
                      {pcs
                        .filter(
                          (p) => !labFilter || p.laboratoryId === labFilter,
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code}
                          </option>
                        ))}
                    </select>
                    <select
                      aria-label="Filter jenis pengguna"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                    >
                      <option value="">Semua jenis pengguna</option>
                      {["STUDENT", "LECTURER", "STAFF", "EXTERNAL"].map((t) => (
                        <option key={t} value={t}>
                          {labels[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <UsageReport
                    sessions={selectedAttendance}
                    requests={selectedRequests}
                    pcs={pcs.filter(
                      (p) =>
                        (!labFilter || p.laboratoryId === labFilter) &&
                        (!pcFilter || p.id === pcFilter),
                    )}
                    asOf={data.serverTime}
                    from={from}
                    to={to}
                    attendanceTable={attendanceTable}
                    requestTable={requestTable}
                    exportURL={exportURL}
                    onReset={() => {
                      setSearch("");
                      setLabFilter("");
                      setStatusFilter("");
                      setPcFilter("");
                      setTypeFilter("");
                      setFrom("");
                      setTo("");
                    }}
                  />
                </>
              )}
              {section === "pengguna" && (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Pengguna terdaftar</h2>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Nama</th>
                            <th>Email</th>
                            <th>Jenis</th>
                            <th>Peran</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.users.map((u) => (
                            <tr key={u.id}>
                              <td>{u.name}</td>
                              <td>{u.email}</td>
                              <td>{labels[u.userType]}</td>
                              <td>{labels[u.role]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Jejak audit administratif</h2>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Waktu</th>
                            <th>Pelaku</th>
                            <th>Tindakan</th>
                            <th>Alasan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.audits.map((a) => (
                            <tr key={a.id}>
                              <td>{dt(a.createdAt)}</td>
                              <td>{a.actor.name}</td>
                              <td>{labels[a.action] || a.action}</td>
                              <td>{a.reason || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
              {section === "profil" && (
                <AccountProfile
                  user={user}
                  onEdit={() => {
                    reset({
                      name: user.name,
                      institution: user.institution || "",
                    });
                    setModal("profile");
                  }}
                />
              )}
            </>
          )}
          <footer className="footer">
            <span>© 2026 LabTrack · Universitas Kristen Petra</span>
            <span>
              <span className="dot green" />
              Pembaruan otomatis setiap 20 detik
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => {
          setModal(null);
          setQrLab("");
        }}
        onClick={(e) => {
          if (e.target === dialog.current) {
            setModal(null);
            setQrLab("");
          }
        }}
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">LABTRACK</span>
            <h2>
              {
                (
                  {
                    reserve: "Ajukan peminjaman PC",
                    review: "Tolak pengajuan",
                    checkin: scanId
                      ? "Scan presensi harian"
                      : "Masuk laboratorium",
                    checkout: "Koreksi presensi",
                    lab: "Data laboratorium",
                    pc: "Data komputer",
                    profile: "Ubah profil",
                    createUser: "Tambah pengguna",
                    device: "Kredensial agen",
                    qr: "QR presensi laboratorium",
                  } as Record<string, string>
                )[modal || ""]
              }
            </h2>
          </div>
          <button
            aria-label="Tutup dialog"
            onClick={() => {
              setModal(null);
              setQrLab("");
            }}
          >
            <X size={19} />
          </button>
        </div>
        {modal === "qr" ? (
          <div className="qr-display">
            {qr ? (
              <Image
                unoptimized
                src={qr}
                alt="Kode QR presensi laboratorium"
                width={280}
                height={280}
              />
            ) : (
              <p>Memuat kode QR…</p>
            )}
            <h3>{labs.find((l) => l.id === qrLab)?.name}</h3>
            <button
              className="small danger"
              onClick={async () => {
                if (
                  !confirm(
                    "Ganti QR laboratorium? QR yang sudah dicetak sebelumnya tidak dapat dipakai lagi.",
                  )
                )
                  return;
                const r = await fetch("/api/qr", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ labId: qrLab }),
                });
                if (r.ok) {
                  await getQR(qrLab);
                  toast.success("QR diganti. Cetak dan pasang QR yang baru.");
                } else toast.error("Tidak dapat mengganti QR.");
              }}
            >
              Ganti QR laboratorium
            </button>
            <Link
              className="button"
              href={"/display/lab/" + qrLab}
              target="_blank"
            >
              Buka tampilan cetak QR laboratorium
            </Link>
            <p>
              QR cetak berlaku sampai diganti oleh administrator.
              <br />
              Pindai dengan kamera ponsel, lalu masuk ke akun Anda.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(submit)}>
            {modal === "reserve" && (
              <>
                <Field label="Laboratorium">
                  <select {...register("laboratoryId")}>
                    <option value="">Semua laboratorium</option>
                    {borrowingLabs
                      .filter((l) => l.active)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Komputer">
                  <select {...register("pcId", { required: true })}>
                    <option value="">Pilih komputer</option>
                    {borrowingPCs
                      .filter(
                        (p) =>
                          (!watched.laboratoryId ||
                            p.laboratoryId === watched.laboratoryId) &&
                          !["MAINTENANCE", "UNAVAILABLE", "REMOTE"].includes(
                            p.status,
                          ),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} · {p.gpu || p.cpu}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="form-grid">
                  <Field label="Mulai (WIB)">
                    <input
                      type="datetime-local"
                      required
                      {...register("startAt", { required: true })}
                    />
                  </Field>
                  <Field label="Selesai (WIB)">
                    <input
                      type="datetime-local"
                      required
                      {...register("endAt", { required: true })}
                    />
                  </Field>
                </div>
                <Field label="Tujuan peminjaman">
                  <textarea
                    minLength={5}
                    required
                    {...register("purpose", { required: true })}
                  />
                </Field>
                <div className="notice">
                  Pengajuan akan ditinjau administrator. Waktu diproses dalam
                  Asia/Jakarta (WIB).
                </div>
              </>
            )}
            {modal === "review" && (
              <Field label="Alasan penolakan">
                <textarea
                  required
                  minLength={5}
                  {...register("reason", { required: true })}
                />
              </Field>
            )}
            {modal === "checkin" && (
              <>
                {scanId && (
                  <div className="notice">
                    Satu sesi per hari WIB per laboratorium. Scan pertama
                    mencatat masuk; scan kedua dan berikutnya mencatat atau
                    memperbarui jam keluar terakhir.
                  </div>
                )}
                {admin && (
                  <Field label="Pengguna (kosongkan untuk diri sendiri)">
                    <select {...register("targetUserId")}>
                      <option value="">Saya sendiri</option>
                      {data.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Laboratorium">
                  <select
                    required
                    {...register("laboratoryId", { required: true })}
                  >
                    <option value="">Pilih laboratorium</option>
                    {labs
                      .filter((l) => l.active)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Reservasi disetujui (opsional)">
                  <select {...register("reservationId")}>
                    <option value="">Kunjungan tanpa reservasi PC</option>
                    {requests
                      .filter(
                        (r) =>
                          r.status === "APPROVED" &&
                          r.userId === (watched.targetUserId || user.id),
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.pc.code} · {dt(r.startAt)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Tujuan aktivitas">
                  <textarea
                    required
                    minLength={5}
                    {...register("purpose", { required: true })}
                  />
                </Field>
              </>
            )}
            {modal === "checkout" && (
              <>
                <div className="notice">
                  Sesi akan ditutup dengan waktu keluar dan durasi tidak
                  diketahui. Sistem tidak mengarang waktu keluar.
                </div>
                <Field label="Alasan koreksi / bukti yang tersedia">
                  <textarea
                    required
                    minLength={10}
                    {...register("reason", { required: true })}
                  />
                </Field>
              </>
            )}
            {modal === "lab" && (
              <>
                <Field label="Kode">
                  <input required {...register("code")} />
                </Field>
                <Field label="Nama laboratorium">
                  <input required {...register("name")} />
                </Field>
                <Field label="Deskripsi">
                  <textarea required {...register("description")} />
                </Field>
                <Field label="Lokasi">
                  <input required {...register("location")} />
                </Field>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    defaultChecked={!editing}
                    {...register("active")}
                  />
                  Laboratorium aktif
                </label>
              </>
            )}
            {modal === "pc" && (
              <>
                <div className="form-grid">
                  <Field label="Kode PC">
                    <input required {...register("code")} />
                  </Field>
                  <Field label="Nama komputer">
                    <input required {...register("name")} />
                  </Field>
                </div>
                <Field label="Laboratorium">
                  <select required {...register("laboratoryId")}>
                    <option value="">Pilih laboratorium</option>
                    {labs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Deskripsi">
                  <textarea {...register("description")} />
                </Field>
                <div className="form-grid">
                  <Field label="Prosesor">
                    <input required {...register("cpu")} />
                  </Field>
                  <Field label="RAM">
                    <input required {...register("ram")} />
                  </Field>
                  <Field label="GPU (opsional)">
                    <input {...register("gpu")} />
                  </Field>
                  <Field label="VRAM (MB)">
                    <input type="number" min="0" {...register("vram")} />
                  </Field>
                </div>
                <Field label="Status operasional">
                  <select {...register("status")}>
                    {[
                      "AVAILABLE",
                      "RESERVED",
                      "IN_USE",
                      "REMOTE",
                      "MAINTENANCE",
                      "UNAVAILABLE",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="checkbox">
                  <input type="checkbox" {...register("monitoring")} />
                  Mendukung agen monitoring
                </label>
              </>
            )}
            {modal === "profile" && (
              <>
                <Field label="Nama lengkap">
                  <input required readOnly={!staff} {...register("name")} />
                </Field>
                {!staff && (
                  <p className="notice">
                    Nama mengikuti akun Google kampus dan diperbarui saat Anda
                    masuk.
                  </p>
                )}
                <Field label="Institusi">
                  <input {...register("institution")} />
                </Field>
              </>
            )}
            {modal === "createUser" && (
              <>
                <Field label="Nama">
                  <input required {...register("name")} />
                </Field>
                <Field label="Email">
                  <input type="email" required {...register("email")} />
                </Field>
                <Field label="Kata sandi sementara">
                  <input
                    type="password"
                    minLength={10}
                    required
                    {...register("password")}
                  />
                </Field>
                <Field label="Peran">
                  <select {...register("role")}>
                    {["USER", "LAB_ADMIN", "HEAD_LAB"].map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Jenis pengguna">
                  <select {...register("userType")}>
                    {["STUDENT", "LECTURER", "STAFF", "EXTERNAL"].map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {modal === "device" && (
              <>
                <input type="hidden" {...register("pcId")} />
                <Field label="Sumber data perangkat">
                  <select {...register("simulated")}>
                    <option value="true">SIMULASI · pengembangan</option>
                    <option value="false">Perangkat fisik laboratorium</option>
                  </select>
                </Field>
                <p className="muted">
                  Membuat kredensial baru membatalkan kredensial lama. Rahasia
                  hanya ditampilkan sekali.
                </p>
                {deviceSecret && (
                  <div className="secret">
                    <strong>Simpan rahasia agen berikut:</strong>
                    <code>{deviceSecret}</code>
                    <small>PC_ID: {String(watched.pcId)}</small>
                  </div>
                )}
              </>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Batal
              </button>
              <button className="primary" disabled={isSubmitting}>
                {isSubmitting
                  ? "Menyimpan…"
                  : modal === "device"
                    ? "Buat / rotasi rahasia"
                    : "Simpan"}
                <Check size={16} />
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
