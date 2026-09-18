import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthTokens, JwtPayload, UserRole } from "@rwa/shared";
import { prisma } from "@rwa/db";
import { env } from "./env.js";

export type RefreshFailure = {
  ok: false;
  code: "refresh_token_expired" | "refresh_token_reused" | "refresh_token_invalid";
};

export type RefreshSuccess = { ok: true; tokens: AuthTokens; familyId: string };

const ACCESS_VERIFY: jwt.VerifyOptions = {
  algorithms: ["HS256"],
  issuer: env.jwtIssuer,
  audience: env.jwtAudience,
  clockTolerance: 5,
};

export const accessTokenTtlSeconds = parseDurationSeconds(env.jwtAccessExpires);

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseDurationSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/i.exec(value.trim());
  if (!match) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) return Math.floor(asNumber);
    return 15 * 60;
  }
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  return amount * 60 * 60 * 24;
}

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

function toAuthTokens(accessToken: string, refreshToken: string): AuthTokens {
  const expiresIn = accessTokenTtlSeconds;
  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export function signAccessToken(user: { id: string; username: string }) {
  const payload: JwtPayload = {
    sub: user.id,
    username: user.username,
    typ: "access",
    jti: randomUUID(),
  };
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: "HS256",
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
    expiresIn: accessTokenTtlSeconds,
  });
}

export function verifyAccessToken(token: string) {
  const decoded = jwt.verify(token, env.jwtSecret, ACCESS_VERIFY) as JwtPayload;
  if (decoded.typ !== "access" || !decoded.sub) {
    throw new jwt.JsonWebTokenError("Invalid access token");
  }
  return decoded;
}

export async function issueTokenPair(
  user: { id: string; username: string },
  familyId = randomUUID()
) {
  const now = new Date();
  const rawRefresh = randomBytes(32).toString("base64url");
  const absoluteExpiresAt = addDays(now, env.jwtRefreshAbsoluteDays);
  const expiresAt = minDate(addDays(now, env.jwtRefreshDays), absoluteExpiresAt);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(rawRefresh),
      familyId,
      userId: user.id,
      expiresAt,
      absoluteExpiresAt,
    },
  });

  return {
    tokens: toAuthTokens(signAccessToken(user), rawRefresh),
    familyId,
  };
}

export async function rotateRefreshToken(rawToken: string): Promise<RefreshSuccess | RefreshFailure> {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) return { ok: false, code: "refresh_token_invalid" };

  const now = new Date();

  if (stored.revokedAt) {
    await revokeFamily(stored.familyId);
    return { ok: false, code: "refresh_token_reused" };
  }

  if (stored.expiresAt <= now || stored.absoluteExpiresAt <= now) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: now },
    });
    return { ok: false, code: "refresh_token_expired" };
  }

  const rawRefresh = randomBytes(32).toString("base64url");
  const nextExpiresAt = minDate(addDays(now, env.jwtRefreshDays), stored.absoluteExpiresAt);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count !== 1) return null;

      const next = await tx.refreshToken.create({
        data: {
          tokenHash: hashToken(rawRefresh),
          familyId: stored.familyId,
          userId: stored.userId,
          expiresAt: nextExpiresAt,
          absoluteExpiresAt: stored.absoluteExpiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { replacedById: next.id },
      });

      return next;
    });

    if (!created) return { ok: false, code: "refresh_token_invalid" };

    return {
      ok: true,
      familyId: stored.familyId,
      tokens: toAuthTokens(signAccessToken(stored.user), rawRefresh),
    };
  } catch {
    return { ok: false, code: "refresh_token_invalid" };
  }
}

export async function revokeRefreshToken(rawToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { familyId: true },
  });
  if (!stored) return;
  await revokeFamily(stored.familyId);
}

export async function revokeFamily(familyId: string) {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserRefreshTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

export function toPublicUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  avatar: string;
  role: UserRole;
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
