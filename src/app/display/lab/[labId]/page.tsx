import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Display from "@/components/qr-display";
export default async function Page({
  params,
}: {
  params: Promise<{ labId: string }>;
}) {
  const u = await actor();
  if (u.role !== "LAB_ADMIN") redirect("/app/dashboard");
  const { labId } = await params;
  const lab = await db.laboratory.findUniqueOrThrow({
    where: { id: labId },
    select: { id: true, code: true },
  });
  return <Display lab={lab} />;
}
