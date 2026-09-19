import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env") });

export const env = {
  jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret",
  jwtIssuer: process.env.JWT_ISSUER ?? "rwa-auth",
  jwtAudience: process.env.JWT_AUDIENCE ?? "rwa",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  adminOrigin: process.env.ADMIN_ORIGIN ?? "http://localhost:3004",
  port: Number(process.env.USER_SERVICE_PORT ?? 3005),
  catalogServiceUrl:
    process.env.CATALOG_SERVICE_URL ?? process.env.BOOKS_SERVICE_URL ?? process.env.SHOP_SERVICE_URL ?? "http://localhost:3006",
  storeServiceUrl: process.env.STORE_SERVICE_URL ?? process.env.API_KEY_SERVICE_URL ?? "http://localhost:3009",
  orderServiceUrl: process.env.ORDER_SERVICE_URL ?? process.env.SALES_SERVICE_URL ?? "http://localhost:3007",
};
