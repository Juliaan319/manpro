import AuthForm from "@/components/auth-form";
import { actor } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let authenticated = false;
  try {
    await actor();
    authenticated = true;
  } catch {}
  if (authenticated) redirect("/app/dashboard");
  const { error } = await searchParams;
  const initialError =
    error === "AccessDenied"
      ? "Akses ditolak. Gunakan akun Google terverifikasi dengan email c14 diikuti angka dan domain @john.petra.ac.id."
      : error
        ? "Login belum berhasil. Silakan coba kembali atau hubungi pengelola."
        : "";
  return (
    <AuthForm
      googleEnabled={Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      )}
      initialError={initialError}
    />
  );
}
