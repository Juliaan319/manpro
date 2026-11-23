"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
export default function Display({
  lab,
}: {
  lab: { id: string; code: string };
}) {
  const [image, setImage] = useState("");
  useEffect(() => {
    const update = async () => {
      const r = await fetch("/api/qr?lab=" + lab.id);
      if (r.ok) setImage((await r.json()).image);
    };
    void update();
    const timer = setInterval(update, 90000);
    return () => clearInterval(timer);
  }, [lab.id]);
  return (
    <main className="loading">
      <h1>LabTrack · {lab.code}</h1>
      <h2>QR presensi laboratorium · siap cetak</h2>
      {image && (
        <Image
          unoptimized
          src={image}
          width={340}
          height={340}
          alt="Kode QR presensi laboratorium siap cetak"
        />
      )}
      <p>QR cetak berlaku sampai diganti oleh administrator.</p>
      <p>Gunakan kamera ponsel, lalu autentikasi dengan akun Anda.</p>
      <button className="print-button" onClick={() => window.print()}>
        Cetak QR laboratorium
      </button>
      <Link className="print-button" href="/app/laboratorium">
        Kembali ke laboratorium
      </Link>
    </main>
  );
}
