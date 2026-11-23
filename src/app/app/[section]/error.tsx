"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading">
      <h1>Halaman belum dapat dimuat</h1>
      <p>Periksa koneksi lalu coba lagi.</p>
      <button onClick={reset}>Coba lagi</button>
    </main>
  );
}
