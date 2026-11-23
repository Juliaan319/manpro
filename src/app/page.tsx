import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  FlaskConical,
  Monitor,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
export default function Home() {
  return (
    <main className="public-site">
      <header className="public-nav">
        <Link href="/" className="public-brand">
          <FlaskConical size={27} />
          labtrack<span>petra.</span>
        </Link>
        <nav aria-label="Navigasi utama">
          <a href="#laboratorium">Laboratorium</a>
          <a href="#layanan">Layanan</a>
          <a href="#panduan">Cara penggunaan</a>
        </nav>
        <details className="public-mobile-menu">
          <summary>Menu</summary>
          <div>
            <a href="#laboratorium">Laboratorium</a>
            <a href="#layanan">Layanan</a>
            <a href="#panduan">Cara penggunaan</a>
          </div>
        </details>
        <Link className="public-login" href="/login">
          Masuk LabTrack <ArrowUpRight size={17} />
        </Link>
      </header>
      <section className="public-hero">
        <div className="hero-copy">
          <span className="public-kicker">
            UNIVERSITAS KRISTEN PETRA · SURABAYA
          </span>
          <h1>
            Laboratorium
            <br />
            Informatika<span>Petra.</span>
          </h1>
          <p>
            Portal peminjaman PC Lab AI, pengajuan akses remote, dan presensi
            laboratorium untuk mahasiswa Informatika Universitas Kristen Petra.
          </p>
          <div className="public-actions">
            <Link href="/login">
              Masuk LabTrack <ArrowUpRight size={19} />
            </Link>
          </div>
          <div className="hero-note">
            <span>AI / VR</span>
            <p>
              10 PC Lab AI / RTX 3070
              <br />
              Presensi laboratorium AI dan VR.
            </p>
          </div>
        </div>
        <div className="hero-photo">
          <Image
            src="/images/lab-petra-hd.png"
            alt="Interior ruang Petra dari foto pengguna, ditingkatkan dengan AI"
            width={1536}
            height={1024}
            priority
          />
          <span className="photo-label">
            LABORATORIUM PETRA <ArrowUpRight size={18} />
          </span>
          <div className="photo-caption">
            Laboratorium Informatika
            <br />
            Universitas Kristen Petra
          </div>
        </div>
      </section>
      <section className="public-services" id="layanan">
        <span className="public-kicker">LAYANAN LABORATORIUM</span>
        <h2>Peminjaman dan presensi</h2>
        <div className="service-grid">
          {[
            {
              n: "01",
              title: "Peminjaman PC Lab AI",
              text: "Lihat spesifikasi PC, pilih jadwal, dan pantau persetujuan peminjaman dari perangkat Anda.",
              Icon: Monitor,
              href: "/login",
              cta: "Pilih komputer",
            },
            {
              n: "02",
              title: "Presensi QR laboratorium",
              text: "Masuk dan keluar laboratorium melalui portal atau QR. Lihat kembali riwayat kegiatan Anda.",
              Icon: ScanLine,
              href: "/login",
              cta: "Buka presensi",
            },
            {
              n: "03",
              title: "Riwayat penggunaan",
              text: "Lihat status pengajuan, reservasi PC, dan catatan kunjungan laboratorium Anda.",
              Icon: ShieldCheck,
              href: "/login",
              cta: "Lihat riwayat",
            },
          ].map((x) => (
            <Link className="service-card" key={x.n} href={x.href}>
              <div>
                <span>{x.n}</span>
                <x.Icon size={26} />
              </div>
              <h3>{x.title}</h3>
              <p>{x.text}</p>
              <strong>
                {x.cta}
                <ArrowUpRight size={18} />
              </strong>
            </Link>
          ))}
        </div>
      </section>
      <section className="public-labs" id="laboratorium">
        <span className="public-kicker">LABORATORIUM AI & VR</span>
        <h2>Fasilitas laboratorium</h2>
        <div>
          <article>
            <span>01 / ARTIFICIAL INTELLIGENCE</span>
            <h3>Laboratorium AI</h3>
            <p>
              Eksplorasi pembelajaran mesin, kecerdasan buatan, dan komputasi
              berbasis GPU.
            </p>
          </article>
          <article>
            <span>02 / VIRTUAL REALITY</span>
            <h3>Laboratorium VR</h3>
            <p>
              Pengembangan realitas virtual, pengalaman imersif, dan simulasi
              interaktif.
            </p>
          </article>
        </div>
      </section>
      <section className="public-guide" id="panduan">
        <div>
          <span className="public-kicker">MULAI DALAM DUA LANGKAH</span>
          <h2>Cara menggunakan portal</h2>
        </div>
        <ol>
          {[
            [
              "Pilih PC dan ajukan jadwal",
              "Tunggu peninjauan serta persetujuan administrator.",
            ],
            [
              "Catat masuk dan keluar laboratorium",
              "Gunakan reservasi pada waktunya atau catat kunjungan tanpa PC.",
            ],
          ].map(([title, text], i) => (
            <li key={title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <footer className="public-footer">
        <Link className="public-brand" href="/">
          labtrack<span>petra.</span>
        </Link>
        <p>
          Sistem informasi laboratorium AI & VR
          <br />
          Universitas Kristen Petra, Surabaya
        </p>
        <Link href="/login">
          Masuk LabTrack <ArrowUpRight size={16} />
        </Link>
      </footer>
    </main>
  );
}
