import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/auth";
const percent = z.number().min(0).max(100).nullable().optional(),
  metric = z.number().nonnegative().nullable().optional();
const schema = z.object({
  pcId: z.string(),
  simulated: z.boolean(),
  cpuPercent: percent,
  ramPercent: percent,
  gpuName: z.string().max(200).nullable().optional(),
  gpuPercent: percent,
  gpuMemoryUsed: metric,
  gpuMemoryTotal: metric,
  gpuTemperature: z.number().min(-50).max(150).nullable().optional(),
  gpuPower: metric,
});
export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());
    await rateLimit("telemetry:" + data.pcId, 10);
    const c = await db.deviceCredential.findUnique({
      where: { pcId: data.pcId },
    });
    const supplied = createHash("sha256")
      .update(req.headers.get("authorization")?.replace(/^Bearer /, "") || "")
      .digest();
    if (!c || !timingSafeEqual(supplied, Buffer.from(c.secretHash, "hex")))
      return NextResponse.json(
        { error: "Kredensial perangkat tidak valid." },
        { status: 401 },
      );
    if (data.simulated !== c.simulated)
      return NextResponse.json(
        { error: "Sumber telemetri tidak cocok dengan kredensial." },
        { status: 400 },
      );
    await db.$transaction([
      db.pCTelemetry.create({ data: { ...data, simulated: c.simulated } }),
      db.pC.update({
        where: { id: data.pcId },
        data: { lastHeartbeat: new Date() },
      }),
    ]);
    return NextResponse.json({ ok: true, simulated: c.simulated });
  } catch {
    return NextResponse.json(
      { error: "Telemetri tidak valid atau terlalu sering." },
      { status: 400 },
    );
  }
}
