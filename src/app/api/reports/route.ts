import { NextResponse } from "next/server";
import { actor } from "@/lib/auth";
import { assertRole, labels } from "@/lib/rules";
import { reportWhere } from "@/lib/service";
import { db } from "@/lib/db";
import { PDFDocument, StandardFonts } from "pdf-lib";
export async function GET(req: Request) {
  try {
    const u = await actor();
    assertRole(u.role, ["LAB_ADMIN", "HEAD_LAB"]);
    const p = new URL(req.url).searchParams;
    const where = reportWhere(p);
    const kind = p.get("kind") || "attendance";
    let rows: string[][];
    if (kind === "requests") {
      const records = await db.pCBorrowRequest.findMany({
        where: {
          ...(p.get("q")?.trim()
            ? {
                OR: [
                  {
                    user: {
                      name: {
                        contains: p.get("q")!.trim(),
                        mode: "insensitive" as const,
                      },
                    },
                  },
                  {
                    pc: {
                      code: {
                        contains: p.get("q")!.trim(),
                        mode: "insensitive" as const,
                      },
                    },
                  },
                  {
                    purpose: {
                      contains: p.get("q")!.trim(),
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
          laboratoryId: p.get("lab") || undefined,
          pcId: p.get("pc") || undefined,
          user: p.get("type")
            ? { userType: p.get("type") as import("@prisma/client").UserType }
            : undefined,
          status:
            (p.get("status") as import("@prisma/client").RequestStatus) ||
            undefined,
          startAt: {
            gte: p.get("from")
              ? new Date(p.get("from") + "T00:00:00+07:00")
              : undefined,
            lte: p.get("to")
              ? new Date(p.get("to") + "T23:59:59.999+07:00")
              : undefined,
          },
        },
        include: { user: true, pc: true, laboratory: true },
        orderBy: { startAt: "desc" },
      });
      rows = [
        [
          "Pengguna",
          "Laboratorium",
          "PC",
          "Mulai (WIB)",
          "Selesai (WIB)",
          "Status",
          "Tujuan",
        ],
        ...records.map((r) => [
          r.user.name,
          r.laboratory.name,
          r.pc.code,
          r.startAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
          r.endAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
          labels[r.status],
          r.purpose,
        ]),
      ];
    } else {
      const records = await db.attendanceSession.findMany({
        where,
        include: { user: true, pc: true, laboratory: true },
        orderBy: { checkIn: "desc" },
      });
      rows = [
        [
          "Pengguna",
          "Laboratorium",
          "PC",
          "Masuk (WIB)",
          "Keluar (WIB)",
          "Durasi (menit)",
          "Status",
        ],
        ...records.map((r) => [
          r.user.name,
          r.laboratory.name,
          r.pc?.code || "-",
          r.checkIn.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
          r.checkOut?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) ||
            "Tidak diketahui / aktif",
          r.durationMinutes?.toString() || "-",
          labels[r.status],
        ]),
      ];
    }
    if (p.get("format") === "pdf") {
      const pdf = await PDFDocument.create(),
        font = await pdf.embedFont(StandardFonts.Helvetica);
      let page = pdf.addPage([842, 595]),
        y = 560;
      page.drawText(
        "LabTrack - Laporan " +
          (kind === "requests" ? "Peminjaman" : "Presensi"),
        { x: 30, y, size: 18, font },
      );
      y -= 30;
      for (const row of rows) {
        if (y < 35) {
          page = pdf.addPage([842, 595]);
          y = 560;
        }
        const line = row.join(" | ").replace(/[^\x20-\x7E]/g, " ");
        for (let i = 0; i < line.length; i += 145) {
          if (y < 35) {
            page = pdf.addPage([842, 595]);
            y = 560;
          }
          page.drawText(line.slice(i, i + 145), { x: 30, y, size: 9, font });
          y -= 14;
        }
      }
      return new Response(Buffer.from(await pdf.save()), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="labtrack.pdf"',
        },
      });
    }
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                (/^[=+@-]/.test(v) ? "'" : "") +
                v.replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="labtrack.csv"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Laporan tidak dapat dibuat. Periksa izin dan filter." },
      { status: 403 },
    );
  }
}
