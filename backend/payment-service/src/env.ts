import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env") });

export const env = {
  jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret",
  jwtIssuer: process.env.JWT_ISSUER ?? "rwa-auth",
  jwtAudience: process.env.JWT_AUDIENCE ?? "rwa",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  adminOrigin: process.env.ADMIN_ORIGIN ?? "http://localhost:3004",
  port: Number(process.env.PAYMENT_SERVICE_PORT ?? 3008),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  salesServiceUrl: process.env.ORDER_SERVICE_URL ?? process.env.SALES_SERVICE_URL ?? "http://localhost:3007",
  internalSecret: process.env.INTERNAL_SERVICE_SECRET ?? process.env.JWT_SECRET ?? "dev-internal",
};

export const stripeEnabled = Boolean(env.stripeSecretKey);
