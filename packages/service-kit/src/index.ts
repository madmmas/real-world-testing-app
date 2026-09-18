import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@rwa/db";
import {
  canAccessAdminSection,
  isAdminRole,
  isPublicRole,
  type AdminRole,
  type AdminSection,
  type JwtPayload,
} from "@rwa/shared";

export type AuthedRequest = Request & {
  user?: JwtPayload;
  actor?: { id: string; role: AdminRole };
};

export type JwtEnv = {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
};

export function publicCors(webOrigin: string, adminOrigin: string) {
  return cors({ origin: [webOrigin, adminOrigin], credentials: true });
}

export function createService(name: string) {
  const app = express();
  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    const started = Date.now();
    res.on("finish", () => {
      const path = req.originalUrl?.split("?")[0] ?? req.path;
      const entry = {
        service: name,
        method: req.method,
        path,
        status: res.statusCode,
        ms: Date.now() - started,
      };
      console.log(
        JSON.stringify({ "@timestamp": new Date().toISOString(), ...entry, msg: "request" })
      );
    });
    next();
  });
  app.get("/health", (_req, res) => res.json({ ok: true, service: name }));
  return app;
}

export function requireJwt(env: JwtEnv) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: "Missing bearer token", code: "token_invalid" });
    try {
      const decoded = jwt.verify(token, env.jwtSecret, {
        algorithms: ["HS256"],
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
        clockTolerance: 5,
      }) as JwtPayload;
      if (decoded.typ !== "access") {
        return res.status(401).json({ error: "Invalid token", code: "token_invalid" });
      }
      req.user = decoded;
      return next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: "Token expired", code: "token_expired" });
      }
      return res.status(401).json({ error: "Invalid token", code: "token_invalid" });
    }
  };
}

export function verifyAccessToken(token: string, env: JwtEnv): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      clockTolerance: 5,
    }) as JwtPayload;
    return decoded.typ === "access" ? decoded : null;
  } catch {
    return null;
  }
}

export function requireAdmin() {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user || !isAdminRole(user.role)) {
      return res.status(403).json({ error: "Admin only" });
    }
    req.actor = { id: user.id, role: user.role };
    return next();
  };
}

export function requireSection(section: AdminSection) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.actor || !canAccessAdminSection(req.actor.role, section)) {
      return res.status(403).json({ error: "Forbidden for this admin role" });
    }
    return next();
  };
}

export async function loadPublicAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !isPublicRole(user.role)) return null;
  return user;
}

export async function requireShopUser(req: AuthedRequest, res: Response) {
  const user = await loadPublicAccount(req.user!.sub);
  if (!user || user.role !== "shop") {
    res.status(403).json({ error: "Shop user role required" });
    return null;
  }
  return user;
}

export async function requireBuyer(req: AuthedRequest, res: Response) {
  const user = await loadPublicAccount(req.user!.sub);
  if (!user) {
    res.status(403).json({ error: "Authenticated user role required" });
    return null;
  }
  return user;
}

export function requireInternal(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.header("x-internal-secret") !== secret) {
      return res.status(401).json({ error: "Invalid internal secret" });
    }
    return next();
  };
}

export async function serviceFetch<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string | null; internalSecret?: string } = {}
): Promise<T> {
  const { token, internalSecret, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (rest.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (internalSecret) headers.set("x-internal-secret", internalSecret);
  const timeoutMs = Number(process.env.SERVICE_FETCH_TIMEOUT_MS ?? 8000);
  const retries = Math.max(0, Number(process.env.SERVICE_FETCH_RETRIES ?? 2));

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}${path}`, { ...rest, headers, signal: ac.signal });
      const text = await res.text();
      let body = {} as T & { error?: string };
      if (text) {
        try {
          body = JSON.parse(text) as T & { error?: string };
        } catch {
          const err = new Error(`Service ${path} failed`);
          (err as Error & { status: number }).status = res.status || 502;
          throw err;
        }
      }
      if (!res.ok) {
        const err = new Error((body as { error?: string }).error ?? `Service ${path} failed`);
        (err as Error & { status: number }).status = res.status;
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          throw err;
        }
        lastError = err;
        continue;
      }
      return body;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const status = (lastError as Error & { status?: number }).status;
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw lastError;
      }
      if (attempt === retries) throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error(`Service ${path} failed`);
}

export function bearerToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export { elasticsearchUrl, getElasticsearch } from "./elasticsearch.js";
export { isUnleashEnabled, otelEnabled, startUnleash } from "./telemetry.js";

export function toPublicUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  avatar: string;
  role: string;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    phoneNumber: user.phoneNumber,
    avatar: user.avatar,
    role: user.role,
  };
}
