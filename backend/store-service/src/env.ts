import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env") });

export const env = {
  jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret",
  jwtIssuer: process.env.JWT_ISSUER ?? "rwa-auth",
  jwtAudience: process.env.JWT_AUDIENCE ?? "rwa",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  adminOrigin: process.env.ADMIN_ORIGIN ?? "http://localhost:3004",
  port: Number(process.env.STORE_SERVICE_PORT ?? process.env.API_KEY_SERVICE_PORT ?? 3009),
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL ?? "http://localhost:3008",
  internalSecret: process.env.INTERNAL_SERVICE_SECRET ?? process.env.JWT_SECRET ?? "dev-internal",
};
