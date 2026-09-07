import { PrismaClient } from "@prisma/client";
import { logger } from "../config/logger";

export const prisma = new PrismaClient();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  logger.info("Prisma disconnected");
  process.exit(0);
});
