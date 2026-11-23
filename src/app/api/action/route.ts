import { canAccessAccount, studentEmailMessage } from "@/lib/access";
import { NextResponse } from "next/server";
import { actor, rateLimit } from "@/lib/auth";
import { db } from "@/lib/db";
import { reserve, review, cancel, checkin, checkout } from "@/lib/service";
import { assertRole } from "@/lib/rules";
import { z } from "zod";
import { hash } from "bcryptjs";
import { randomBytes, createHash } from "crypto";
export async function POST(req: Request) {
  try {
    const applicationOrigin = new URL(process.env.NEXTAUTH_URL || req.url)
      .origin;
    if (applicationOrigin !== req.headers.get("origin"))
      return NextResponse.json(
        { error: "Asal permintaan tidak valid." },
        { status: 403 },
      );
    const u = await actor();
    await rateLimit("action:" + u.id, 60);
    const { action, ...d } = await req.json();
    let result: unknown;
    switch (action) {
      case "reserve":
        result = await reserve(u, d);
        break;
      case "review":
        result = await review(
          u,
          z.string().parse(d.id),
          z.boolean().parse(d.approve),
          d.reason,
        );
        break;
      case "cancel":
        result = await cancel(u, z.string().parse(d.id));
        break;
      case "checkin":
        result = await checkin(u, d);
        break;
      case "checkout":
        result = await checkout(u, z.string().parse(d.id), d.reason);
        break;
      case "profile": {
        const p = z
          .object({
            name: z.string().min(1).max(200).optional(),
            institution: z.string().max(150).optional(),
          })
          .parse(d);
        await db.user.update({
          where: { id: u.id },
          data: {
            institution: p.institution,
            ...(u.role !== "USER" && p.name ? { name: p.name } : {}),
          },
        });
        break;
      }
      case "lab": {
        assertRole(u.role, ["LAB_ADMIN"]);
        const p = z
          .object({
            code: z.string().min(2).max(20),
            name: z.string().min(3),
            description: z.string().min(3),
            location: z.string().min(2),
            active: z.boolean(),
          })
          .parse(d);
        result = await db.$transaction(async (tx) => {
          const lab = d.id
            ? await tx.laboratory.update({
                where: { id: z.string().parse(d.id) },
                data: p,
              })
            : await tx.laboratory.create({ data: p });
          await tx.auditLog.create({
            data: { actorId: u.id, action: "SAVE_LAB", entityId: lab.id },
          });
          return lab;
        });
        break;
      }
      case "pc": {
        assertRole(u.role, ["LAB_ADMIN"]);
        const p = z
          .object({
            code: z.string().min(3),
            laboratoryId: z.string().min(1),
            name: z.string().min(3),
            description: z.string(),
            cpu: z.string().min(2),
            ram: z.string().min(1),
            gpu: z.string().nullable(),
            vram: z.number().int().nonnegative().nullable(),
            status: z.enum([
              "AVAILABLE",
              "RESERVED",
              "IN_USE",
              "REMOTE",
              "MAINTENANCE",
              "UNAVAILABLE",
            ]),
            monitoring: z.boolean(),
          })
          .parse(d);
        result = await db.$transaction(async (tx) => {
          if (d.id)
            await tx.$queryRaw`SELECT id FROM "PC" WHERE id=${d.id} FOR UPDATE`;
          if (d.id) {
            const existing = await tx.pC.findUniqueOrThrow({
              where: { id: d.id },
            });
            if (
              existing.laboratoryId !== p.laboratoryId &&
              ((await tx.pCBorrowRequest.count({ where: { pcId: d.id } })) ||
                (await tx.attendanceSession.count({ where: { pcId: d.id } })) ||
                (await tx.remoteRequest.count({ where: { pcId: d.id } })))
            ) {
              throw new Error(
                "PC yang memiliki riwayat tidak dapat dipindahkan ke laboratorium lain.",
              );
            }
          }
          const pc = d.id
            ? await tx.pC.update({
                where: { id: z.string().parse(d.id) },
                data: p,
              })
            : await tx.pC.create({ data: p });
          await tx.auditLog.create({
            data: { actorId: u.id, action: "SAVE_PC", entityId: pc.id },
          });
          return pc;
        });
        break;
      }
      case "deleteLab":
      case "deletePC": {
        assertRole(u.role, ["LAB_ADMIN"]);
        const id = z.string().parse(d.id);
        await db.$transaction(async (tx) => {
          if (action === "deleteLab")
            await tx.laboratory.delete({ where: { id } });
          else await tx.pC.delete({ where: { id } });
          await tx.auditLog.create({
            data: { actorId: u.id, action, entityId: id },
          });
        });
        break;
      }
      case "createUser": {
        assertRole(u.role, ["LAB_ADMIN"]);
        const p = z
          .object({
            name: z.string().min(3),
            email: z.string().email(),
            password: z.string().min(10),
            role: z.enum(["USER", "LAB_ADMIN", "HEAD_LAB"]),
            userType: z.enum(["STUDENT", "LECTURER", "STAFF", "EXTERNAL"]),
          })
          .parse(d);
        if (
          !canAccessAccount({
            role: p.role,
            email: p.email,
            userType: p.userType,
          })
        )
          throw new Error(studentEmailMessage);
        await db.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              name: p.name,
              email: p.email.toLowerCase(),
              passwordHash: await hash(p.password, 12),
              role: p.role,
              userType: p.userType,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: u.id,
              action: "CREATE_USER",
              entityId: created.id,
              reason: p.role,
            },
          });
        });
        break;
      }
      case "device": {
        assertRole(u.role, ["LAB_ADMIN"]);
        const pcId = z.string().parse(d.pcId),
          simulated = z.boolean().parse(d.simulated);
        const secret = randomBytes(32).toString("hex");
        await db.$transaction(async (tx) => {
          await tx.deviceCredential.upsert({
            where: { pcId },
            create: {
              pcId,
              secretHash: createHash("sha256").update(secret).digest("hex"),
              simulated,
            },
            update: {
              secretHash: createHash("sha256").update(secret).digest("hex"),
              simulated,
            },
          });
          await tx.pC.update({
            where: { id: pcId },
            data: { monitoring: true },
          });
          await tx.auditLog.create({
            data: {
              actorId: u.id,
              action: "ROTATE_DEVICE_SECRET",
              entityId: pcId,
              reason: simulated ? "SIMULASI" : "PERANGKAT",
            },
          });
        });
        result = { secret };
        break;
      }
      default:
        throw new Error("Tindakan tidak dikenal.");
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Isian tidak valid. Periksa semua kolom."
        : error instanceof Error && !("code" in error)
          ? error.message
          : "Operasi gagal. Periksa keunikan kode, relasi data, atau konflik jadwal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
