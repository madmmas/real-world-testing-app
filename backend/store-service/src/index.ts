import "./env.js";
import { createHash, randomBytes } from "node:crypto";
import express from "express";
import { prisma, writeAudit } from "@rwa/db";
import { createApiKeyBody, createStoreBody } from "@rwa/shared/rest";
import {
  bearerToken,
  createService,
  parseBody,
  publicCors,
  requireAdmin,
  requireInternal,
  requireJwt,
  requireSection,
  requireShopUser,
  serviceFetch,
  type AuthedRequest,
} from "@rwa/service-kit";
import { env } from "./env.js";

const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const app = createService("store");
app.use(publicCors(env.webOrigin, env.adminOrigin));
app.use(express.json());
const auth = requireJwt(jwt);
const admin = [auth, requireAdmin()];

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "shop"}-${Math.random().toString(36).slice(2, 6)}`;
}

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

app.get("/me/store", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  const member = await prisma.storeMember.findFirst({
    where: { userId: req.user!.sub },
    include: { store: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ store: member?.store ?? null });
});

app.post("/me/store", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  const body = parseBody(createStoreBody, req.body, res);
  if (!body) return;
  const name = body.name;
  const existing = await prisma.storeMember.findFirst({ where: { userId: req.user!.sub } });
  if (existing) return res.status(409).json({ error: "You already have a store" });
  const store = await prisma.store.create({
    data: {
      name,
      slug: slugify(name),
      ownerId: req.user!.sub,
      members: { create: { userId: req.user!.sub, role: "owner" } },
    },
  });
  await writeAudit({
    actorId: req.user!.sub,
    action: "store.create",
    resource: "store",
    resourceId: store.id,
    meta: { name: store.name },
  });
  res.status(201).json({ store });
});

app.post("/me/stripe/connect", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  try {
    const data = await serviceFetch<{ url: string }>(env.paymentServiceUrl, "/connect", {
      method: "POST",
      token: bearerToken(req),
    });
    res.json(data);
  } catch (error) {
    res.status((error as { status?: number }).status ?? 400).json({
      error: error instanceof Error ? error.message : "Stripe connect failed",
    });
  }
});

app.post("/me/stripe/sync", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  try {
    const data = await serviceFetch<{ store: unknown }>(env.paymentServiceUrl, "/sync", {
      method: "POST",
      token: bearerToken(req),
    });
    res.json(data);
  } catch (error) {
    res.status((error as { status?: number }).status ?? 400).json({
      error: error instanceof Error ? error.message : "Stripe sync failed",
    });
  }
});

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

app.get("/admin/stats", ...admin, requireSection("stats"), async (_req, res) => {
  const stores = await prisma.store.count();
  res.json({ stores });
});

app.get("/admin/stores", ...admin, requireSection("stores"), async (_req, res) => {
  const stores = await prisma.store.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { books: true, orders: true } } },
  });
  res.json({
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      ownerId: store.ownerId,
      stripeOnboarded: store.stripeOnboarded,
      bookCount: store._count.books,
      orderCount: store._count.orders,
    })),
  });
});

app.listen(env.port, () => {
  console.log(`Store service listening on http://localhost:${env.port}`);
});
