import { PrismaClient } from "@prisma/client";
export async function ensureAIInventory(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const lab = await tx.laboratory.findUniqueOrThrow({
      where: { code: "AI" },
    });
    const template = await tx.pC.findUniqueOrThrow({
      where: { code: "AI-PC-01" },
    });
    if (template.laboratoryId !== lab.id)
      throw new Error("PC acuan tidak berada di Laboratorium AI.");
    const specs = {
      cpu: "AMD Ryzen 9 5900X 12-Core Processor",
      ram: "32 GB",
      gpu: "NVIDIA GeForce RTX 3070",
      vram: null,
    };
    for (let i = 1; i <= 10; i++) {
      const code = "AI-PC-" + String(i).padStart(2, "0");
      const existing = await tx.pC.findUnique({ where: { code } });
      if (existing && existing.laboratoryId !== lab.id)
        throw new Error("Kode PC sudah dipakai laboratorium lain.");
      await tx.pC.upsert({
        where: { code },
        create: {
          id: code.toLowerCase(),
          code,
          laboratoryId: lab.id,
          name: "Komputer Laboratorium AI " + String(i).padStart(2, "0"),
          description:
            "Spesifikasi mengikuti AI-PC-01; kesiapan penggunaan dikelola terpisah.",
          ...specs,
          status: "UNAVAILABLE",
          monitoring: false,
        },
        update: {
          ...specs,
          ...(existing?.description.includes(
            "Spesifikasi dan kesiapan penggunaan belum dikonfirmasi",
          )
            ? {
                description:
                  "Spesifikasi mengikuti AI-PC-01; kesiapan penggunaan dikelola terpisah.",
              }
            : {}),
        },
      });
    }
  });
}
