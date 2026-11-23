"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { FlaskConical, ArrowRight, ShieldCheck, Monitor } from "lucide-react";
export default function AuthForm({
  googleEnabled,
  initialError = "",
}: {
  googleEnabled: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; password: string }>();
  const [error, setError] = useState(initialError);
  const [googleBusy, setGoogleBusy] = useState(false);
  function destination() {
    const callback = new URLSearchParams(location.search).get("callbackUrl");
    return callback &&
      (callback.startsWith("/app/") || callback.startsWith("/checkin?"))
      ? callback
      : "/app/dashboard";
  }
  async function googleLogin() {
    setGoogleBusy(true);
    setError("");
    try {
      await signIn("google", { callbackUrl: destination() });
    } catch {
      setError("Tidak dapat membuka login Google. Silakan coba kembali.");
      setGoogleBusy(false);
    }
  }
  async function submit(values: { email: string; password: string }) {
    setError("");
    try {
      const result = await signIn("credentials", {
        email: values.email.trim(),
        password: values.password,
        redirect: false,
      });
      if (result?.error)
        throw new Error(
          "Login kata sandi hanya untuk admin/kepala lab. Periksa email dan kata sandi pengelola.",
        );
      router.push(destination());
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tidak dapat masuk. Coba lagi.",
      );
    }
  }
  return (
    <main className="auth">
      <section className="auth-story">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <FlaskConical />
          </span>
          LabTrack<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow">UNIVERSITAS KRISTEN PETRA</span>
          <h1>
            Portal Laboratorium
            <br />
            Informatika Petra.
          </h1>
          <p>
            Peminjaman PC Lab AI, pengajuan remote, dan presensi mahasiswa
            Informatika.
          </p>
          <div className="auth-illustration">
            <Monitor size={82} />
            <span>LABORATORIUM AI + VR</span>
            <div className="signal">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <small>Surabaya, Indonesia · Sistem Laboratorium</small>
      </section>
      <section className="auth-content">
        <div className="auth-box">
          <span className="eyebrow">SELAMAT DATANG DI LABTRACK</span>
          <h2>Masuk LabTrack</h2>
          <p>Mahasiswa masuk menggunakan akun Google Informatika Petra.</p>
          <button
            className="google-login"
            disabled={!googleEnabled || googleBusy}
            onClick={googleLogin}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.23-2.51c-.9.6-2.05.97-3.39.97-2.61 0-4.83-1.76-5.62-4.12H3.04v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.38 13.92A6 6 0 0 1 6.06 12c0-.67.12-1.32.32-1.92V7.49H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.51l3.34-2.59Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.49l3.34 2.59C7.17 7.72 9.39 5.96 12 5.96Z"
              />
            </svg>
            {googleBusy ? "Menghubungkan…" : "Masuk dengan Google"}
          </button>
          {!googleEnabled && (
            <p className="google-unavailable" role="status">
              Login Google belum diaktifkan oleh pengelola.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <details className="staff-login">
            <summary>Masuk pengelola (admin / kepala lab)</summary>
            <form onSubmit={handleSubmit(submit)}>
              <label>
                Email
                <input
                  type="email"
                  {...register("email", { required: true })}
                  autoComplete="email"
                />
              </label>
              <label>
                Kata sandi
                <input
                  type="password"
                  {...register("password", { required: true })}
                  autoComplete="current-password"
                />
              </label>
              {Object.keys(errors).length > 0 && (
                <p className="error" role="alert">
                  Lengkapi email dan kata sandi Anda.
                </p>
              )}
              <button disabled={isSubmitting} className="primary">
                {isSubmitting ? "Memproses…" : "Masuk"}
                <ArrowRight size={17} />
              </button>
            </form>
          </details>
          <p className="muted">
            Jika akun kampus tidak dapat digunakan, hubungi pengelola
            laboratorium.
          </p>
          <div className="secure">
            <ShieldCheck size={16} />
            Akses aman sesuai peran pengguna
          </div>
        </div>
      </section>
    </main>
  );
}
