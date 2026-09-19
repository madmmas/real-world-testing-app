import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env") });

export const env = {
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  adminOrigin: process.env.ADMIN_ORIGIN ?? "http://localhost:3004",
  port: Number(process.env.INVENTORY_SERVICE_PORT ?? 3010),
  internalSecret: process.env.INTERNAL_SERVICE_SECRET ?? process.env.JWT_SECRET ?? "dev-internal",
};
