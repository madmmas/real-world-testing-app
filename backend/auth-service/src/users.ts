import type { Express } from "express";
import { prisma, writeAudit } from "@rwa/db";
import { canAssignRole } from "@rwa/shared";
import { patchAdminUserBody, patchMeBody } from "@rwa/shared/rest";
import {
  parseBody,
  requireAdmin,
  requireJwt,
  requireSection,
  serviceFetch,
  toPublicUser,
  type AuthedRequest,
} from "@rwa/service-kit";
import { env } from "./env.js";

export function mountUserRoutes(app: Express) {
  const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
  const auth = requireJwt(jwt);
  const admin = [auth, requireAdmin()];

  app.get("/me", auth, async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({ user: toPublicUser(user) });
  });

  app.patch("/me", auth, async (req: AuthedRequest, res) => {
    const body = parseBody(patchMeBody, req.body, res);
    if (!body) return;
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phoneNumber: body.phoneNumber,
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
    const [users, catalog, store, orders] = await Promise.all([
      role === "marketing"
        ? Promise.resolve(null)
        : prisma.user.count({
            where: role === "sales" ? { role: { in: ["user", "shop"] } } : undefined,
          }),
      role === "sales"
        ? Promise.resolve({ books: 0 })
        : serviceFetch<{ books: number }>(env.catalogServiceUrl, "/admin/stats", { token }).catch(() => ({ books: 0 })),
      role === "marketing"
        ? Promise.resolve({ stores: 0 })
        : serviceFetch<{ stores: number }>(env.storeServiceUrl, "/admin/stats", { token }).catch(() => ({ stores: 0 })),
      role === "marketing"
        ? Promise.resolve(null)
        : serviceFetch<{ orders: number }>(env.orderServiceUrl, "/admin/stats", { token }).catch(() => ({ orders: 0 })),
    ]);

    if (role === "marketing") return res.json({ books: catalog.books });
    if (role === "sales") {
      return res.json({
        users,
        stores: store.stores,
        orders: (orders as { orders: number }).orders,
      });
    }
    return res.json({
      users,
      stores: store.stores,
      books: catalog.books,
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
    const body = parseBody(patchAdminUserBody, req.body, res);
    if (!body) return;
    const nextRole = body.role;
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
      data: { role: nextRole },
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
    await writeAudit({
      actorId: req.actor!.id,
      action: "user.role.change",
      resource: "user",
      resourceId: user.id,
      meta: { from: target.role, to: nextRole },
    });
    res.json({ user });
  });

  app.get("/admin/audit", ...admin, requireSection("audit"), async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({
      logs: logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  });
}
