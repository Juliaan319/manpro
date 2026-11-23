import { randomUUID } from "crypto";
import { actor } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Checkin({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  try {
    await actor();
  } catch {
    redirect(
      "/login?callbackUrl=" +
        encodeURIComponent("/checkin?token=" + encodeURIComponent(token || "")),
    );
  }
  redirect(
    "/app/presensi?qr=" +
      encodeURIComponent(token || "") +
      "&scan=" +
      randomUUID(),
  );
}
