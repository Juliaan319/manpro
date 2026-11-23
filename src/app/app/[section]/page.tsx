import { actor } from "@/lib/auth";
import { redirect } from "next/navigation";
import Workspace from "@/components/workspace";
import { notFound } from "next/navigation";
const allowed = [
  "dashboard",
  "remote",
  "laboratorium",
  "peminjaman",
  "pengajuan",
  "riwayat-peminjaman",
  "presensi",
  "riwayat-presensi",
  "pc",
  "monitoring",
  "riwayat",
  "laporan",
  "pengguna",
  "profil",
];
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ scan?: string }>;
}) {
  const { section } = await params;
  if (!allowed.includes(section)) notFound();
  const u = await actor();
  if (
    u.role === "USER" &&
    [
      "pengajuan",
      "pc",
      "monitoring",
      "riwayat",
      "laporan",
      "pengguna",
    ].includes(section)
  )
    redirect("/app/dashboard");
  if (
    u.role === "HEAD_LAB" &&
    ![
      "dashboard",
      "remote",
      "laboratorium",
      "monitoring",
      "riwayat",
      "laporan",
      "profil",
    ].includes(section)
  )
    redirect("/app/dashboard");
  if (section === "riwayat") redirect("/app/laporan");
  const { scan } = await searchParams;
  return <Workspace key={scan || section} section={section} scanId={scan} />;
}
