import {
  ShieldCheck,
  GraduationCap,
  UserRound,
  Monitor,
  FileChartColumn,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
type Person = {
  name: string;
  email: string;
  role: string;
  userType: string;
  identity?: string;
  institution?: string;
};
export default function AccountProfile({
  user,
  onEdit,
}: {
  user: Person;
  onEdit: () => void;
}) {
  const student = user.role === "USER",
    admin = user.role === "LAB_ADMIN";
  const role = student
    ? "Mahasiswa Informatika"
    : admin
      ? "Administrator laboratorium"
      : "Kepala laboratorium";
  const Icon = student ? GraduationCap : ShieldCheck;
  return (
    <div
      className={
        "account-profile " + (student ? "student" : admin ? "admin" : "head")
      }
    >
      <section className="panel profile-identity">
        <div className="profile-role">
          <Icon size={20} />
          {role}
        </div>
        <div className="profile-avatar">
          {user.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </div>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <button className="primary" onClick={onEdit}>
          <UserRound size={16} />
          Ubah identitas saya
        </button>
      </section>
      <div>
        <section className="panel profile-details">
          <h2>
            {student ? "Identitas akademik saya" : "Identitas pengelola saya"}
          </h2>
          <dl>
            <div>
              <dt>Nama lengkap</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Email akun</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>{student ? "NRP" : "NIP / nomor identitas"}</dt>
              <dd>{user.identity || "Belum diisi"}</dd>
            </div>
            {student && (
              <div>
                <dt>Program studi</dt>
                <dd>Informatika</dd>
              </div>
            )}
            <div>
              <dt>Institusi</dt>
              <dd>{user.institution || "Universitas Kristen Petra"}</dd>
            </div>
            <div>
              <dt>Peran akun</dt>
              <dd>{role}</dd>
            </div>
          </dl>
          <p className="muted">
            Identitas ini milik akun yang sedang masuk. Email, nomor identitas,
            dan peran akun dikelola oleh pengelola.
          </p>
        </section>
        <section className="panel profile-details">
          <h2>
            {student
              ? "Aktivitas pribadi saya"
              : admin
                ? "Tanggung jawab pengelolaan"
                : "Ruang lingkup pemantauan"}
          </h2>
          <p>
            {student
              ? "Pantau pemesanan, ajukan remote PC, dan catat presensi Anda sendiri."
              : admin
                ? "Kelola inventaris, tampilkan QR laboratorium, tinjau pengajuan dan surat mahasiswa, serta koreksi presensi dengan alasan audit."
                : "Pantau aktivitas laboratorium, penggunaan perangkat, dan laporan. Akses pengelolaan bersifat baca saja."}
          </p>
          <div className="profile-shortcuts">
            <Link
              href={
                student
                  ? "/app/riwayat-peminjaman"
                  : admin
                    ? "/app/pengajuan"
                    : "/app/laporan"
              }
            >
              <ClipboardList size={17} />
              {student
                ? "Riwayat pemesanan saya"
                : admin
                  ? "Tinjau pengajuan"
                  : "Lihat laporan"}
            </Link>
            <Link
              href={
                student
                  ? "/app/presensi"
                  : admin
                    ? "/app/laboratorium"
                    : "/app/monitoring"
              }
            >
              <Monitor size={17} />
              {student
                ? "Presensi saya"
                : admin
                  ? "Laboratorium & QR"
                  : "Monitoring PC"}
            </Link>
            {!student && (
              <Link href="/app/laporan">
                <FileChartColumn size={17} />
                Statistik penggunaan
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
