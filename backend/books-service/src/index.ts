import "./env.js";
import express from "express";
import { prisma } from "@rwa/db";
import {
  bearerToken,
  createService,
  publicCors,
  requireAdmin,
  requireInternal,
  requireJwt,
  requireSection,
  requireShopUser,
  serviceFetch,
  type AuthedRequest,
} from "@rwa/service-kit";
import { slugify, toGqlBook } from "./catalog.js";
import { env } from "./env.js";
import { yoga } from "./graphql.js";
import { startFlags } from "./flags.js";
import { reindexAllBooks, startBookIndexSync } from "./search.js";

const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const app = createService("books");
app.use(publicCors(env.webOrigin, env.adminOrigin));
app.use(yoga.graphqlEndpoint, yoga);
app.use(express.json());

const auth = requireJwt(jwt);
const admin = [auth, requireAdmin()];

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
  const name = String(req.body.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Store name is required" });
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

app.get("/admin/stats", ...admin, requireSection("stats"), async (_req, res) => {
  const [stores, books] = await Promise.all([prisma.store.count(), prisma.book.count()]);
  res.json({ stores, books });
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

app.post("/internal/books/:id/reserve", requireInternal(env.internalSecret), async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: req.params.id }, include: { store: true } });
  if (!book) return res.status(404).json({ error: "Not found" });
  res.json({
    book: {
      ...toGqlBook(book),
      storeId: book.storeId,
      ownerId: book.store.ownerId,
      store: {
        ...toGqlBook(book).store,
        stripeAccountId: book.store.stripeAccountId,
        stripeOnboarded: book.store.stripeOnboarded,
      },
    },
  });
});

app.post("/internal/reindex", requireInternal(env.internalSecret), async (_req, res) => {
  const indexed = await reindexAllBooks();
  res.json({ ok: true, indexed });
});

app.listen(env.port, () => {
  console.log(`Books service listening on http://localhost:${env.port}`);
  startFlags();
  startBookIndexSync();
});
