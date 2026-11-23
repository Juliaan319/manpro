import { actor } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function Page({
  params,
}: {
  params: Promise<{ pcId: string }>;
}) {
  const u = await actor();
  if (u.role !== "LAB_ADMIN") redirect("/app/dashboard");
  const { pcId } = await params;
  const pc = await db.pC.findUniqueOrThrow({
    where: { id: pcId },
    select: { laboratoryId: true },
  });
  redirect("/display/lab/" + pc.laboratoryId);
}
