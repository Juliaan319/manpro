import Link from "next/link";
export default function NotFound() {
  return (
    <main className="loading">
      <h1>Halaman tidak ditemukan</h1>
      <p>Alamat yang Anda buka tidak tersedia.</p>
      <Link className="button primary" href="/app/dashboard">
        Kembali ke dasbor
      </Link>
    </main>
  );
}
