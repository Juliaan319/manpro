import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureAIInventory } from "../prisma/inventory";
const db = new PrismaClient();
ensureAIInventory(db)
  .then(async () =>
    console.log(
      "Jumlah PC Laboratorium AI:",
      await db.pC.count({ where: { laboratory: { code: "AI" } } }),
    ),
  )
  .finally(() => db.$disconnect());
