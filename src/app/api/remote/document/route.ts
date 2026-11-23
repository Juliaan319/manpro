import { NextResponse } from "next/server";
import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(req: Request) {
  try {
    const u = await actor();
    const id = new URL(req.url).searchParams.get("id") || "";
    const r = await db.remoteRequest.findUniqueOrThrow({ where: { id } });
    if (r.userId !== u.id && u.role !== "LAB_ADMIN")
      return NextResponse.json(
        { error: "Tidak memiliki izin mengunduh surat." },
        { status: 403 },
      );
    return new Response(Buffer.from(r.fileBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="' +
          r.fileName.replace(/[^a-zA-Z0-9._ -]/g, "_") +
          '"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Surat tidak ditemukan atau sesi tidak valid." },
      { status: 404 },
    );
  }
}
