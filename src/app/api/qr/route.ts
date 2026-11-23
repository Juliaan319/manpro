import { NextResponse } from "next/server";
import { actor } from "@/lib/auth";
import { assertRole } from "@/lib/rules";
import { signPrintedLabQR } from "@/lib/qr";
import { db } from "@/lib/db";
import QRCode from "qrcode";
export async function GET(req: Request) {
  try {
    const u = await actor();
    assertRole(u.role, ["LAB_ADMIN"]);
    const id = new URL(req.url).searchParams.get("lab") || "";
    const lab = await db.laboratory.findUniqueOrThrow({ where: { id } });
    const url = new URL("/checkin", process.env.NEXTAUTH_URL);
    url.searchParams.set("token", signPrintedLabQR(id, lab.qrVersion));
    return NextResponse.json({
      url: url.toString(),
      image: await QRCode.toDataURL(url.toString()),
      expiresAt: null,
    });
  } catch {
    return NextResponse.json(
      { error: "Tidak memiliki izin." },
      { status: 403 },
    );
  }
}

export async function POST(req: Request) {
  try {
    if (
      req.headers.get("origin") !==
      new URL(process.env.NEXTAUTH_URL || req.url).origin
    )
      return NextResponse.json(
        { error: "Asal permintaan tidak valid." },
        { status: 403 },
      );
    const u = await actor();
    assertRole(u.role, ["LAB_ADMIN"]);
    const { labId } = await req.json();
    if (typeof labId !== "string") throw new Error();
    await db.$transaction(async (tx) => {
      await tx.laboratory.update({
        where: { id: labId },
        data: { qrVersion: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: { actorId: u.id, action: "ROTATE_LAB_QR", entityId: labId },
      });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat mengganti QR laboratorium." },
      { status: 403 },
    );
  }
}
