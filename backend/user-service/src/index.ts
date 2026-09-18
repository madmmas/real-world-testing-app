import "./env.js";
import express from "express";
import { prisma } from "@rwa/db";
import { canAssignRole } from "@rwa/shared";
import {
  createService,
  publicCors,
  requireAdmin,
  requireJwt,
  requireSection,
  serviceFetch,
  toPublicUser,
  type AuthedRequest,
} from "@rwa/service-kit";
import { env } from "./env.js";

const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const app = createService("user");
app.use(publicCors(env.webOrigin, env.adminOrigin));
app.use(express.json());

const auth = requireJwt(jwt);
const admin = [auth, requireAdmin()];

app.get("/me", auth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user: toPublicUser(user) });
});

app.patch("/me", auth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
    },
  });
  res.json({ user: toPublicUser(user) });
});

app.get("/admin/me", ...admin, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user: toPublicUser(user) });
});

app.get("/admin/stats", ...admin, requireSection("stats"), async (req: AuthedRequest, res) => {
  const role = req.actor!.role;
  const token = req.headers.authorization?.slice(7);
  const [users, shop, orders] = await Promise.all([
    role === "marketing"
      ? Promise.resolve(null)
      : prisma.user.count({
          where: role === "sales" ? { role: { in: ["user", "shop"] } } : undefined,
        }),
    role === "sales"
      ? serviceFetch<{ stores: number }>(env.booksServiceUrl, "/admin/stats", { token }).catch(() => ({ stores: 0, books: 0 }))
      : serviceFetch<{ stores: number; books: number }>(env.booksServiceUrl, "/admin/stats", { token }).catch(() => ({
          stores: 0,
          books: 0,
        })),
    role === "marketing"
      ? Promise.resolve(null)
      : serviceFetch<{ orders: number }>(env.salesServiceUrl, "/admin/stats", { token }).catch(() => ({ orders: 0 })),
  ]);

  if (role === "marketing") return res.json({ books: (shop as { books?: number }).books ?? 0 });
  if (role === "sales") {
    return res.json({
      users,
      stores: (shop as { stores: number }).stores,
      orders: (orders as { orders: number }).orders,
    });
  }
  return res.json({
    users,
    stores: (shop as { stores: number }).stores,
    books: (shop as { books: number }).books,
    orders: (orders as { orders: number }).orders,
  });
});

app.get("/admin/users", ...admin, requireSection("users"), async (req: AuthedRequest, res) => {
  const users = await prisma.user.findMany({
    where: req.actor!.role === "sales" ? { role: { in: ["user", "shop"] } } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
  res.json({ users });
});

app.patch("/admin/users/:id", ...admin, requireSection("users"), async (req: AuthedRequest, res) => {
  const nextRole = String(req.body.role ?? "");
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Not found" });
  if (!canAssignRole(req.actor!.role, target.role, nextRole)) {
    return res.status(403).json({ error: "You cannot assign that role" });
  }
  if (target.role === "superadmin" && nextRole !== "superadmin") {
    const remaining = await prisma.user.count({
      where: { role: "superadmin", id: { not: target.id } },
    });
    if (remaining === 0) {
      return res.status(400).json({ error: "Keep at least one superadmin" });
    }
  }
  const user = await prisma.user.update({
    where: { id: target.id },
    data: { role: nextRole as typeof target.role },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
  res.json({ user });
});

app.listen(env.port, () => {
  console.log(`User service listening on http://localhost:${env.port}`);
});
