import { NextResponse } from "next/server";
import { z } from "zod";
import { actor, rateLimit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertRole } from "@/lib/rules";
import {
  remoteSelect,
  requestRemote,
  reviewRemote,
  cancelRemote,
} from "@/lib/remote";
export async function GET() {
  try {
    const u = await actor();
    await db.remoteRequest.updateMany({
      where: { status: "PENDING", endAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
    await db.remoteRequest.updateMany({
      where: { status: "APPROVED", endAt: { lt: new Date() } },
      data: { status: "COMPLETED" },
    });
    const [requests, policy] = await Promise.all([
      db.remoteRequest.findMany({
        where: u.role === "USER" ? { userId: u.id } : {},
        select: remoteSelect,
        orderBy: { createdAt: "desc" },
      }),
      db.remotePolicy.findUnique({ where: { id: "main" } }),
    ]);
    return NextResponse.json({
      requests,
      templateUrl: policy?.templateUrl || "/api/remote/form",
    });
  } catch {
    return NextResponse.json(
      { error: "Silakan masuk terlebih dahulu." },
      { status: 401 },
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
    await rateLimit("remote:" + u.id, 30);
    let result: unknown;
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if (Number(req.headers.get("content-length") || 0) > 6 * 1024 * 1024)
        throw new Error("Ukuran unggahan terlalu besar.");
      const f = await req.formData();
      const file = f.get("file");
      if (!(file instanceof File))
        throw new Error("Surat PDF wajib diunggah sebelum mengajukan remote.");
      result = await requestRemote(
        u,
        Object.fromEntries(
          ["pcId", "startAt", "endAt", "purpose"].map((k) => [k, f.get(k)]),
        ),
        { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
      );
    } else {
      const d = await req.json();
      if (d.action === "review") result = await reviewRemote(u, d);
      else if (d.action === "cancel")
        result = await cancelRemote(u, z.string().parse(d.id));
      else if (d.action === "template") {
        assertRole(u.role, ["LAB_ADMIN"]);
        const templateUrl = d.url
          ? z.string().url().startsWith("https://").parse(d.url)
          : null;
        await db.$transaction([
          db.remotePolicy.upsert({
            where: { id: "main" },
            create: { id: "main", templateUrl },
            update: { templateUrl },
          }),
          db.auditLog.create({
            data: {
              actorId: u.id,
              action: "REMOTE_TEMPLATE",
              entityId: "main",
            },
          }),
        ]);
      } else throw new Error("Tindakan tidak dikenal.");
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Isian pengajuan tidak valid."
            : e instanceof Error && !("code" in e)
              ? e.message
              : "Operasi gagal. Periksa isian atau konflik jadwal.",
      },
      { status: 400 },
    );
  }
}
