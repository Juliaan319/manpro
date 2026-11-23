"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  FileText,
  Monitor,
  ShieldCheck,
  Upload,
  Plus,
  X,
} from "lucide-react";
import { labels } from "@/lib/rules";
type PC = {
  id: string;
  code: string;
  cpu: string;
  ram: string;
  gpu: string | null;
  status: string;
  effectiveStatus: string;
  laboratory: { code: string };
};
type Item = {
  id: string;
  userId: string;
  pcId: string;
  pc: { code: string };
  user: { name: string; email: string; identity: string | null };
  startAt: string;
  endAt: string;
  purpose: string;
  status: string;
  fileName: string;
  rejectionReason: string | null;
  accessUrl: string | null;
};
type Values = {
  pcId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  file: FileList;
};
const dt = (s: string) =>
  new Date(s).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function RemotePanel({
  user,
  pcs,
  onChanged,
}: {
  user: { id: string; role: string };
  pcs: PC[];
  onChanged: () => Promise<void>;
}) {
  const [requests, setRequests] = useState<Item[]>([]),
    [template, setTemplate] = useState("/api/remote/form"),
    [error, setError] = useState(""),
    [show, setShow] = useState(false),
    [filter, setFilter] = useState(""),
    [review, setReview] = useState<{ id: string; approve: boolean } | null>(
      null,
    ),
    [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>();
  const admin = user.role === "LAB_ADMIN",
    head = user.role === "HEAD_LAB";
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/remote", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRequests(d.requests);
      setTemplate(d.templateUrl);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Data remote tidak dapat dimuat.",
      );
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = setInterval(() => void load(), 20000);
    return () => clearInterval(timer);
  }, [load]);
  async function send(data: FormData | Record<string, unknown>) {
    const r = await fetch("/api/remote", {
      method: "POST",
      headers:
        data instanceof FormData
          ? undefined
          : { "Content-Type": "application/json" },
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    await load();
    await onChanged();
    toast.success("Pengajuan remote berhasil diperbarui.");
  }
  async function submit(v: Values) {
    try {
      const f = new FormData();
      f.set("pcId", v.pcId);
      f.set("startAt", new Date(v.startAt + ":00+07:00").toISOString());
      f.set("endAt", new Date(v.endAt + ":00+07:00").toISOString());
      f.set("purpose", v.purpose);
      if (!v.file?.[0]) throw new Error("Surat PDF wajib diunggah.");
      f.set("file", v.file[0]);
      await send(f);
      reset();
      setShow(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pengajuan gagal.");
    }
  }
  async function configure(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      setBusy(true);
      await send({ action: "template", url: f.get("url") });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }
  async function decide(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!review) return;
    const f = new FormData(e.currentTarget);
    try {
      setBusy(true);
      await send({
        action: "review",
        ...review,
        reason: f.get("reason") || undefined,
        accessUrl: f.get("accessUrl") || undefined,
      });
      setReview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Peninjauan gagal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="remote-module">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="remote-intro">
        <div>
          <span className="eyebrow">PERMOHONAN AKSES JARAK JAUH</span>
          <h2>Ajukan PC untuk pekerjaan beberapa hari.</h2>
          <p>
            Isi surat permohonan terlebih dahulu. Jadwal remote hanya berlaku
            setelah disetujui administrator.
          </p>
        </div>
        {!head && (
          <button className="primary" onClick={() => setShow(!show)}>
            <Plus size={17} />
            Ajukan remote PC
          </button>
        )}
      </section>
      <div className="remote-steps">
        <div>
          <FileText />
          <strong>1. Isi formulir</strong>
          <p>
            Unduh formulir, lengkapi identitas, jadwal, dan tujuan penggunaan.
          </p>
          <a
            className="button"
            href={template}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowDownToLine size={16} />
            Unduh / buka formulir
          </a>
        </div>
        <div>
          <Upload />
          <strong>2. Unggah surat</strong>
          <p>
            Unggah surat yang telah diisi sebagai PDF, maksimal 5 MB, bersama
            pengajuan Anda.
          </p>
        </div>
        <div>
          <ShieldCheck />
          <strong>3. Tunggu persetujuan</strong>
          <p>
            Admin memeriksa surat dan konflik jadwal sebelum memberikan izin.
          </p>
        </div>
      </div>
      {admin && (
        <details className="remote-settings">
          <summary>Pengaturan formulir permohonan</summary>
          <form onSubmit={configure}>
            <label>
              Tautan Google Docs / surat kampus (HTTPS, opsional)
              <input
                name="url"
                type="url"
                placeholder="https://docs.google.com/..."
                defaultValue={template.startsWith("https://") ? template : ""}
              />
            </label>
            <p className="muted">
              Kosongkan untuk menggunakan formulir PDF bawaan. Pastikan
              mahasiswa dapat membuka tautan yang dipasang.
            </p>
            <button disabled={busy}>Simpan tautan formulir</button>
          </form>
        </details>
      )}
      {show && !head && (
        <section className="panel remote-form">
          <div className="panel-heading">
            <h2>Pengajuan remote PC baru</h2>
            <button
              aria-label="Tutup pengajuan remote"
              onClick={() => setShow(false)}
            >
              <X size={17} />
            </button>
          </div>
          <form onSubmit={handleSubmit(submit)}>
            <label>
              Komputer AI
              <select required {...register("pcId", { required: true })}>
                <option value="">Pilih komputer</option>
                {pcs
                  .filter(
                    (p) =>
                      p.laboratory.code === "AI" &&
                      !["UNAVAILABLE", "MAINTENANCE", "REMOTE"].includes(
                        p.status,
                      ),
                  )
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.code} · {p.gpu || p.cpu}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Mulai (WIB)
                <input
                  type="datetime-local"
                  required
                  {...register("startAt", { required: true })}
                />
              </label>
              <label>
                Selesai (WIB)
                <input
                  type="datetime-local"
                  required
                  {...register("endAt", { required: true })}
                />
              </label>
            </div>
            <label>
              Tujuan penggunaan
              <textarea
                minLength={10}
                maxLength={2000}
                required
                {...register("purpose", { required: true })}
              />
            </label>
            <label>
              Surat permohonan yang sudah diisi (PDF, maksimal 5 MB)
              <input
                type="file"
                accept="application/pdf,.pdf"
                required
                {...register("file", { required: true })}
              />
            </label>
            <div className="notice">
              Pengajuan tidak langsung mengaktifkan akses remote. Tunggu
              persetujuan dan petunjuk pengelola.
            </div>
            <button disabled={isSubmitting} className="primary">
              {isSubmitting ? "Mengirim…" : "Kirim pengajuan remote"}
            </button>
          </form>
        </section>
      )}
      {review && (
        <section className="panel remote-form">
          <div className="panel-heading">
            <h2>{review.approve ? "Setujui remote PC" : "Tolak remote PC"}</h2>
            <button
              aria-label="Tutup peninjauan"
              onClick={() => setReview(null)}
            >
              <X size={17} />
            </button>
          </div>
          <form onSubmit={decide}>
            {review.approve ? (
              <>
                <label>
                  Tautan akses / petunjuk remote (HTTPS, opsional)
                  <input
                    name="accessUrl"
                    type="url"
                    placeholder="https://..."
                  />
                </label>
                <div className="notice">
                  Pasang hanya tautan layanan remote resmi atau petunjuk kampus.
                  Jangan menuliskan kata sandi di tautan.
                </div>
              </>
            ) : (
              <label>
                Alasan penolakan
                <textarea
                  name="reason"
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
            )}
            <button disabled={busy} className="primary">
              {busy ? "Memproses…" : "Simpan keputusan"}
            </button>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {admin
                ? "Pengajuan remote mahasiswa"
                : head
                  ? "Riwayat remote PC"
                  : "Pengajuan remote saya"}
            </h2>
            <p>Dokumen dan keputusan tersimpan bersama setiap pengajuan.</p>
          </div>
          <select
            aria-label="Filter status remote"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="">Semua status</option>
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
        </div>
        {requests.filter((r) => !filter || r.status === filter).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {user.role !== "USER" && <th>Mahasiswa</th>}
                  <th>PC / tujuan</th>
                  <th>Jadwal WIB</th>
                  <th>Status</th>
                  <th>Surat</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {requests
                  .filter((r) => !filter || r.status === filter)
                  .map((r) => (
                    <tr key={r.id}>
                      {user.role !== "USER" && (
                        <td>
                          <strong>{r.user.name}</strong>
                          <small>{r.user.email}</small>
                        </td>
                      )}
                      <td>
                        <span className="pc-inline">
                          <Monitor size={15} />
                          {r.pc.code}
                        </span>
                        <small>{r.purpose}</small>
                      </td>
                      <td>
                        {dt(r.startAt)}
                        <small>s.d. {dt(r.endAt)}</small>
                      </td>
                      <td>
                        <span className={"badge " + r.status.toLowerCase()}>
                          {labels[r.status]}
                        </span>
                        {r.rejectionReason && (
                          <small className="error">{r.rejectionReason}</small>
                        )}
                      </td>
                      <td>
                        {admin || r.userId === user.id ? (
                          <a
                            className="button small"
                            href={"/api/remote/document?id=" + r.id}
                          >
                            <ArrowDownToLine size={14} />
                            Unduh surat
                          </a>
                        ) : (
                          "Akses admin / pemilik"
                        )}
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
                                    setReview({ id: r.id, approve: true })
                                  }
                                >
                                  Setujui
                                </button>
                                <button
                                  className="small danger"
                                  onClick={() =>
                                    setReview({ id: r.id, approve: false })
                                  }
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
                                onClick={async () => {
                                  if (
                                    !confirm("Batalkan pengajuan remote ini?")
                                  )
                                    return;
                                  try {
                                    await send({ action: "cancel", id: r.id });
                                  } catch (e) {
                                    toast.error(
                                      e instanceof Error
                                        ? e.message
                                        : "Gagal membatalkan.",
                                    );
                                  }
                                }}
                              >
                                Batalkan
                              </button>
                            )}
                          {r.status === "APPROVED" &&
                            r.accessUrl &&
                            (admin || r.userId === user.id) && (
                              <a
                                className="button small"
                                href={r.accessUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Petunjuk akses remote
                              </a>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <FileText size={28} />
            <p>Belum ada pengajuan remote yang sesuai.</p>
          </div>
        )}
      </section>
    </div>
  );
}
