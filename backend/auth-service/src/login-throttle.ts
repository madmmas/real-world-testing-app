import type { Request } from "express";

export type CaptchaMode = "frictionless" | "interactive";

const WINDOW_MS = 15 * 60 * 1000;
export const FAILED_PASSWORD_LIMIT = 5;

type FailState = { count: number; updatedAt: number };

const failures = new Map<string, FailState>();

function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function failKey(ip: string, username: string) {
  return `${ip}:${username.trim().toLowerCase()}`;
}

function prune(now: number) {
  for (const [key, state] of failures) {
    if (now - state.updatedAt > WINDOW_MS) failures.delete(key);
  }
}

export function loginThrottleKey(req: Request, username: string) {
  return failKey(clientIp(req), username);
}

export function requiredCaptchaMode(key: string): CaptchaMode {
  const now = Date.now();
  prune(now);
  const state = failures.get(key);
  if (!state) return "frictionless";
  if (now - state.updatedAt > WINDOW_MS) {
    failures.delete(key);
    return "frictionless";
  }
  return state.count >= FAILED_PASSWORD_LIMIT ? "interactive" : "frictionless";
}

export function recordFailedPassword(key: string) {
  const now = Date.now();
  prune(now);
  const current = failures.get(key);
  const count = (current && now - current.updatedAt <= WINDOW_MS ? current.count : 0) + 1;
  failures.set(key, { count, updatedAt: now });
  return count;
}

export function clearFailedPasswords(key: string) {
  failures.delete(key);
}
