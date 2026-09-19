import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import type { ZodType } from "zod";
import { stringify } from "yaml";
import {
  checkoutBody,
  createApiKeyBody,
  createStoreBody,
  credentialsBody,
  forgotPasswordBody,
  logoutBody,
  patchAdminUserBody,
  patchMeBody,
  refreshBody,
  resetPasswordBody,
  signupBody,
} from "./rest.js";

const registry = new OpenAPIRegistry();

function jsonBody(schema: ZodType) {
  return {
    body: {
      required: true,
      content: {
        "application/json": { schema },
      },
    },
  };
}

function jsonOk(description: string) {
  return {
    200: { description },
    400: { description: "Validation error" },
  };
}

registry.registerPath({
  method: "post",
  path: "/auth/session/login",
  summary: "Admin session login (Altcha required)",
  request: jsonBody(credentialsBody),
  responses: jsonOk("Admin user"),
});

registry.registerPath({
  method: "post",
  path: "/auth/jwt/login",
  summary: "Public JWT login (Altcha required)",
  request: jsonBody(credentialsBody),
  responses: jsonOk("User and tokens"),
});

registry.registerPath({
  method: "post",
  path: "/auth/jwt/signup",
  summary: "Public signup",
  request: jsonBody(signupBody),
  responses: {
    201: { description: "User and tokens" },
    400: { description: "Validation error" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/jwt/refresh",
  summary: "Rotate refresh token",
  request: jsonBody(refreshBody),
  responses: jsonOk("New token pair"),
});

registry.registerPath({
  method: "post",
  path: "/auth/jwt/logout",
  summary: "Revoke a refresh token",
  request: jsonBody(logoutBody),
  responses: { 204: { description: "Logged out" } },
});

registry.registerPath({
  method: "post",
  path: "/auth/jwt/forgot-password",
  summary: "Request a password reset mail",
  request: jsonBody(forgotPasswordBody),
  responses: jsonOk("Always ok"),
});

registry.registerPath({
  method: "post",
  path: "/auth/jwt/reset-password",
  summary: "Set a new password from a reset token",
  request: jsonBody(resetPasswordBody),
  responses: jsonOk("Password updated"),
});

registry.registerPath({
  method: "patch",
  path: "/me",
  summary: "Update the caller's profile",
  request: jsonBody(patchMeBody),
  responses: jsonOk("Updated user"),
});

registry.registerPath({
  method: "patch",
  path: "/admin/users/{id}",
  summary: "Change a user's role",
  request: jsonBody(patchAdminUserBody),
  responses: jsonOk("Updated user"),
});

registry.registerPath({
  method: "post",
  path: "/checkout",
  summary: "Start checkout for a listed book",
  request: jsonBody(checkoutBody),
  responses: jsonOk("Demo or Stripe checkout"),
});

registry.registerPath({
  method: "post",
  path: "/me/store",
  summary: "Create the caller's shop",
  request: jsonBody(createStoreBody),
  responses: {
    201: { description: "Store" },
    400: { description: "Validation error" },
  },
});

registry.registerPath({
  method: "post",
  path: "/me/keys",
  summary: "Create a partner API key",
  request: jsonBody(createApiKeyBody),
  responses: {
    201: { description: "Key including plaintext once" },
    400: { description: "Validation error" },
  },
});

const document = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Books Library public REST",
    version: "1.0.0",
    description: "Generated from Zod request schemas. GraphQL lives on books-service /graphql.",
  },
  servers: [{ url: "http://localhost:8080", description: "Kong (when gateway is on)" }],
});

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../docs");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "openapi.yaml"), stringify(document));
writeFileSync(resolve(outDir, "openapi.json"), `${JSON.stringify(document, null, 2)}\n`);
console.log("Wrote docs/openapi.yaml and docs/openapi.json");
