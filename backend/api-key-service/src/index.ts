import "./env.js";
import { createHash, randomBytes } from "node:crypto";
import express from "express";
import { prisma, writeAudit } from "@rwa/db";
import { createApiKeyBody } from "@rwa/shared/rest";
import {
  createService,
  parseBody,
  publicCors,
  requireJwt,
  requireShopUser,
  requireInternal,
  type AuthedRequest,
} from "@rwa/service-kit";
import { env } from "./env.js";

const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const app = createService("api-key");
app.use(publicCors(env.webOrigin, env.adminOrigin));
app.use(express.json());
const auth = requireJwt(jwt);

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function mapKey(key: {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  plaintext?: string;
}) {
  return {
    ...key,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
  };
}

app.post("/internal/validate", requireInternal(env.internalSecret), async (req, res) => {
  const apiKey = String(req.body.key ?? "");
  if (!apiKey) return res.status(400).json({ error: "key required" });
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashKey(apiKey) } });
  if (!key || key.revokedAt) return res.status(401).json({ error: "Invalid API key" });
  void prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  res.json({ storeId: key.storeId });
});

app.get("/me/keys", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  const member = await prisma.storeMember.findFirst({ where: { userId: req.user!.sub } });
  if (!member) return res.json({ keys: [] });
  const keys = await prisma.apiKey.findMany({
    where: { storeId: member.storeId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ keys: keys.map(mapKey) });
});

app.post("/me/keys", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  const body = parseBody(createApiKeyBody, req.body ?? {}, res);
  if (!body) return;
  const member = await prisma.storeMember.findFirst({
    where: { userId: req.user!.sub, role: "owner" },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  const plaintext = `rwa_live_${randomBytes(24).toString("hex")}`;
  const key = await prisma.apiKey.create({
    data: {
      storeId: member.storeId,
      name: body.name || "Partner search",
      keyPrefix: plaintext.slice(0, 12),
      keyHash: hashKey(plaintext),
    },
  });
  await writeAudit({
    actorId: req.user!.sub,
    action: "api_key.create",
    resource: "api_key",
    resourceId: key.id,
    meta: { storeId: member.storeId, name: key.name },
  });
  res.status(201).json({ key: mapKey({ ...key, plaintext }) });
});

app.delete("/me/keys/:id", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  const member = await prisma.storeMember.findFirst({
    where: { userId: req.user!.sub, role: "owner" },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  await prisma.apiKey.updateMany({
    where: { id: req.params.id, storeId: member.storeId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAudit({
    actorId: req.user!.sub,
    action: "api_key.revoke",
    resource: "api_key",
    resourceId: req.params.id,
    meta: { storeId: member.storeId },
  });
  res.json({ ok: true });
});

app.listen(env.port, () => {
  console.log(`API key service listening on http://localhost:${env.port}`);
});
