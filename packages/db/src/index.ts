import { PrismaClient, type Prisma } from "@prisma/client";

export const prisma = new PrismaClient();
export { PrismaClient } from "@prisma/client";
export * from "@prisma/client";
export { storeBookCover } from "./covers.js";

export async function writeAudit(input: {
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string;
  meta?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({ data: input });
  } catch (error) {
    console.error("audit log failed", error);
  }
}
