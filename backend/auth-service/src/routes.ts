import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@rwa/db";
import { isAdminRole, isPublicRole } from "@rwa/shared";
import {
  credentialsBody,
  forgotPasswordBody,
  logoutBody,
  refreshBody,
  resetPasswordBody,
  signupBody,
} from "@rwa/shared/rest";
import { parseBody } from "@rwa/service-kit";
import { env } from "./env.js";
import { issueTokenPair, rotateRefreshToken, revokeFamily, revokeRefreshToken, revokeUserRefreshTokens, toPublicUser } from "./tokens.js";
import { hashResetToken, newResetToken, sendPasswordResetMail } from "./mail.js";
import { captchaChallengeHandler, requireCaptcha } from "./captcha.js";
import {
  clearFailedPasswords,
  FAILED_PASSWORD_LIMIT,
  loginThrottleKey,
  recordFailedPassword,
  requiredCaptchaMode,
} from "./login-throttle.js";

const router = Router();

declare module "express-session" {
  interface SessionData {
    userId?: string;
    refreshFamilyId?: string;
  }
}

router.get("/captcha/challenge", captchaChallengeHandler);

router.get("/oauth/providers", (_req, res) => {
  res.json({ google: Boolean(env.googleClientId && env.googleClientSecret) });
});

router.post("/session/login", async (req, res) => {
  const body = parseBody(credentialsBody, req.body, res);
  if (!body) return;
  const { username, password } = body;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Username or password is invalid" });
  }
  if (!isAdminRole(user.role)) {
    return res.status(403).json({ error: "This account is not a platform admin" });
  }
  req.session.userId = user.id;
  return res.json({ user: toPublicUser(user) });
});

router.post("/session/logout", async (req, res) => {
  if (req.session.refreshFamilyId) await revokeFamily(req.session.refreshFamilyId);
  req.session.destroy(() => {
    res.clearCookie("rwa.admin.sid");
    res.status(204).end();
  });
});

router.get("/session/me", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  if (!user || !isAdminRole(user.role)) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ user: toPublicUser(user) });
});

router.post("/jwt/login", async (req, res) => {
  const body = parseBody(credentialsBody, req.body, res);
  if (!body) return;
  const { username, password } = body;
  const throttleKey = loginThrottleKey(req, username);
  const captchaMode = requiredCaptchaMode(throttleKey);
  if (!(await requireCaptcha(req, res, captchaMode))) return;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    const failedAttempts = recordFailedPassword(throttleKey);
    const nextCaptcha = failedAttempts >= FAILED_PASSWORD_LIMIT ? "interactive" : "frictionless";
    return res.status(401).json({
      error: "Username or password is invalid",
      captcha: nextCaptcha,
      failedAttempts,
    });
  }
  clearFailedPasswords(throttleKey);
  if (!isPublicRole(user.role)) {
    return res.status(403).json({ error: "Use the admin console to sign in" });
  }
  const { tokens } = await issueTokenPair(user);
  return res.json({ user: toPublicUser(user), ...tokens });
});

router.post("/jwt/signup", async (req, res) => {
  const body = parseBody(signupBody, req.body, res);
  if (!body) return;
  const { username, firstName, lastName, password } = body;
  if (!(await requireCaptcha(req, res, "frictionless"))) return;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: "Username already taken" });
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: bcrypt.hashSync(password, 10),
      firstName,
      lastName,
      email: `${username}@example.com`,
      avatar: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(firstName)}`,
      role: "user",
    },
  });
  const { tokens } = await issueTokenPair(user);
  return res.status(201).json({ user: toPublicUser(user), ...tokens });
});

router.post("/jwt/from-session", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  if (!user || !isAdminRole(user.role)) return res.status(401).json({ error: "Unauthorized" });
  if (req.session.refreshFamilyId) await revokeFamily(req.session.refreshFamilyId);
  const { tokens, familyId } = await issueTokenPair(user);
  req.session.refreshFamilyId = familyId;
  return res.json(tokens);
});

router.post("/jwt/refresh", async (req, res) => {
  const body = parseBody(refreshBody, req.body, res);
  if (!body) return;
  const result = await rotateRefreshToken(body.refreshToken);
  if (!result.ok) {
    return res.status(401).json({ error: "Invalid refresh token", code: result.code });
  }
  return res.json(result.tokens);
});

router.post("/jwt/logout", async (req, res) => {
  const body = parseBody(logoutBody, req.body ?? {}, res);
  if (!body) return;
  if (body.refreshToken) await revokeRefreshToken(body.refreshToken);
  return res.status(204).end();
});

router.get("/oauth/:provider", (req, res) => {
  const { provider } = req.params;
  if (provider !== "google" || !env.googleClientId || !env.googleClientSecret) {
    return res.status(501).json({ error: "OAuth provider is not configured" });
  }
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleCallbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/oauth/:provider/callback", async (req, res) => {
  const { provider } = req.params;
  const fail = (reason: string) => res.redirect(`${env.webOrigin}/signin?error=${encodeURIComponent(reason)}`);
  if (provider !== "google" || !env.googleClientId || !env.googleClientSecret) {
    return fail("Google sign-in is not configured");
  }
  const code = String(req.query.code ?? "");
  if (!code) return fail("Missing Google auth code");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleCallbackUrl,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("Google token exchange failed");
  const tokenJson = (await tokenRes.json()) as { access_token: string };
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) return fail("Google profile fetch failed");
  const profile = (await profileRes.json()) as {
    email?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  if (!profile.email) return fail("Google account has no email");

  const email = profile.email.toLowerCase();
  let user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) {
    const username = await uniqueUsername(email.split("@")[0] ?? "google-user");
    user = await prisma.user.create({
      data: {
        username,
        passwordHash: bcrypt.hashSync(randomPassword(), 10),
        firstName: profile.given_name ?? "Google",
        lastName: profile.family_name ?? "User",
        email,
        avatar: profile.picture ?? "",
        role: "user",
      },
    });
  } else if (profile.picture && profile.picture !== user.avatar) {
    user = await prisma.user.update({ where: { id: user.id }, data: { avatar: profile.picture } });
  }
  if (!isPublicRole(user.role)) return fail("Use the admin console to sign in");
  const { tokens } = await issueTokenPair(user);
  const hash = new URLSearchParams({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: tokens.expiresAt,
    expires_in: String(tokens.expiresIn),
  });
  return res.redirect(`${env.webOrigin}/signin/callback#${hash.toString()}`);
});

async function uniqueUsername(raw: string) {
  const base = raw.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 24) || "google-user";
  let username = base;
  let n = 0;
  while (await prisma.user.findUnique({ where: { username } })) {
    n += 1;
    username = `${base}${n}`;
  }
  return username;
}

router.post("/jwt/forgot-password", async (req, res) => {
  const body = parseBody(forgotPasswordBody, req.body, res);
  if (!body) return;
  const user = await prisma.user.findFirst({
    where: { email: { equals: body.email, mode: "insensitive" }, role: { in: ["user", "shop"] } },
  });
  if (user) {
    const token = newResetToken();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashResetToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    try {
      await sendPasswordResetMail(user.email, token);
    } catch (error) {
      console.error("password-reset mail failed", error);
    }
  }
  return res.json({ ok: true });
});

router.post("/jwt/reset-password", async (req, res) => {
  const body = parseBody(resetPasswordBody, req.body, res);
  if (!body) return;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(body.token) },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Reset link is invalid or expired" });
  }
  if (!isPublicRole(row.user.role)) {
    return res.status(403).json({ error: "Use the admin console to sign in" });
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: bcrypt.hashSync(body.password, 10) },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);
  await revokeUserRefreshTokens(row.userId);
  return res.json({ ok: true });
});

function randomPassword() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export { router as authRouter };
