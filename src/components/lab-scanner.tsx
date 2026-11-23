"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
export default function LabScanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    generation = useRef(0);
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      generation.current++;
      controls.current?.stop();
    },
    [],
  );
  function stop() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject;
    if (stream instanceof MediaStream)
      stream.getTracks().forEach((t) => t.stop());
    setOpen(false);
  }
  function navigate(text: string) {
    try {
      const u = new URL(text, location.origin);
      if (
        u.origin !== location.origin ||
        u.pathname !== "/checkin" ||
        !u.searchParams.get("token")
      )
        throw new Error();
      stop();
      router.push(u.pathname + u.search);
    } catch {
      setError("Gunakan QR presensi laboratorium dari LabTrack ini.");
    }
  }
  async function start() {
    setError("");
    setOpen(true);
    const version = ++generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (version !== generation.current) return;
      const reader = new BrowserQRCodeReader();
      const c = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        video.current!,
        (result, _error, c) => {
          if (result && version === generation.current) {
            c.stop();
            navigate(result.getText());
          }
        },
      );
      if (version !== generation.current) c.stop();
      else controls.current = c;
    } catch {
      if (version === generation.current)
        setError(
          "Kamera tidak dapat dibuka. Izinkan akses kamera dan gunakan HTTPS atau localhost. Anda juga dapat membuka QR melalui kamera ponsel.",
        );
    }
  }
  return (
    <section className="lab-scanner">
      <div>
        <h2>Presensi dengan QR laboratorium</h2>
        <p>
          Gunakan perangkat Anda yang sudah login. Pindai QR yang disediakan di
          laboratorium, lalu konfirmasi presensi.
        </p>
      </div>
      <button className="primary" onClick={start} disabled={open}>
        <Camera size={17} />
        Pindai QR laboratorium
      </button>
      {open && (
        <div className="scanner-camera">
          <button aria-label="Tutup kamera" onClick={stop}>
            <X size={18} />
          </button>
          <video
            ref={video}
            muted
            playsInline
            autoPlay
            aria-label="Pratinjau kamera pemindai QR"
          />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = new FormData(e.currentTarget).get("url");
              if (typeof text === "string") navigate(text);
            }}
          >
            <label>
              Tautan QR laboratorium (alternatif kamera)
              <input
                name="url"
                type="url"
                required
                placeholder="Tempel tautan dari QR laboratorium"
              />
            </label>
            <button>Buka QR laboratorium</button>
          </form>
        </div>
      )}
    </section>
  );
}
