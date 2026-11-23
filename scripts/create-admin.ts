import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
const db = new PrismaClient();
async function main() {
  const input = z
    .object({
      name: z.string().min(3),
      email: z
        .string()
        .email()
        .transform((v) => v.toLowerCase()),
      password: z.string().min(14),
    })
    .parse({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
  await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hash(input.password, 12),
      role: "LAB_ADMIN",
      userType: "STAFF",
    },
  });
  console.log("Administrator baru berhasil dibuat.");
}
main()
  .catch(() => {
    console.error(
      "Provisioning gagal. Periksa environment, keunikan email, dan koneksi database.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
