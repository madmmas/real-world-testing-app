import "./env.js";
import express from "express";
import { prisma } from "@rwa/db";
import {
  createService,
  publicCors,
  requireAdmin,
  requireInternal,
  requireJwt,
  requireSection,
} from "@rwa/service-kit";
import { env } from "./env.js";
import { yoga } from "./graphql.js";
import { startFlags } from "./flags.js";
import { reindexAllBooks, startBookIndexSync } from "./search.js";

const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const app = createService("catalog");
app.use(publicCors(env.webOrigin, env.adminOrigin));
app.use(yoga.graphqlEndpoint, yoga);
app.use(express.json());

const auth = requireJwt(jwt);
const admin = [auth, requireAdmin()];

app.get("/admin/stats", ...admin, requireSection("stats"), async (_req, res) => {
  const books = await prisma.book.count();
  res.json({ books });
});

app.post("/internal/reindex", requireInternal(env.internalSecret), async (_req, res) => {
  const indexed = await reindexAllBooks();
  res.json({ ok: true, indexed });
});

app.listen(env.port, () => {
  console.log(`Catalog service listening on http://localhost:${env.port}`);
  startFlags();
  startBookIndexSync();
});
