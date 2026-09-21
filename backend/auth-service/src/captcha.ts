import type { NextFunction, Request, Response } from "express";
import { CappedMap, create, deriveHmacKeySecret, randomInt } from "altcha-lib/frameworks/express";
import type { AltchaResult } from "altcha-lib/frameworks/express";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import type { Payload } from "altcha-lib/types";
import { env } from "./env.js";
import { altchaEnabled } from "./flags.js";
import type { CaptchaMode } from "./login-throttle.js";

const store = new CappedMap<string, boolean>({ maxSize: 5_000 });

type AltchaInstance = ReturnType<typeof create>;

let frictionless: AltchaInstance;
let interactive: AltchaInstance;
let hmacSignatureSecret = "";
let hmacKeySignatureSecret = "";
let ready: Promise<void> | undefined;

function paramsFor(mode: CaptchaMode) {
  if (mode === "interactive") {
    return {
      algorithm: "PBKDF2/SHA-256",
      cost: 8_000,
      counter: randomInt(8_000, 12_000),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      data: { mode },
    };
  }
  return {
    algorithm: "PBKDF2/SHA-256",
    cost: 4_000,
    counter: randomInt(4_000, 8_000),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    data: { mode },
  };
}

export async function initCaptcha() {
  if (!ready) {
    ready = (async () => {
      hmacSignatureSecret = env.altchaHmacSecret;
      hmacKeySignatureSecret = await deriveHmacKeySecret(hmacSignatureSecret);
      const shared = {
        hmacSignatureSecret,
        hmacKeySignatureSecret,
        deriveKey,
        store,
      };
      frictionless = create({
        ...shared,
        createChallengeParameters: () => paramsFor("frictionless"),
      });
      interactive = create({
        ...shared,
        createChallengeParameters: () => paramsFor("interactive"),
      });
    })();
  }
  await ready;
}

export async function captchaChallengeHandler(req: Request, res: Response, next: NextFunction) {
  if (!altchaEnabled()) return res.status(404).json({ error: "Altcha is off", enabled: false });
  await initCaptcha();
  const mode: CaptchaMode = req.query.mode === "interactive" ? "interactive" : "frictionless";
  const handler = mode === "interactive" ? interactive.challengeHandler : frictionless.challengeHandler;
  return handler(req, res, next);
}

function payloadMode(result: AltchaResult): CaptchaMode | undefined {
  const payload = result.payload as Payload | null;
  const mode = payload?.challenge?.parameters?.data?.mode;
  return mode === "interactive" || mode === "frictionless" ? mode : undefined;
}

export async function requireCaptcha(req: Request, res: Response, required: CaptchaMode) {
  if (!altchaEnabled()) return true;
  await initCaptcha();
  const result = await frictionless.verify(
    req.body?.altcha,
    deriveKey,
    hmacSignatureSecret,
    hmacKeySignatureSecret,
    store
  );
  const mode = payloadMode(result);
  const verified = Boolean(
    result.verification && "verified" in result.verification && result.verification.verified
  );

  if (!verified || result.error) {
    res.status(400).json({
      error:
        required === "interactive"
          ? "Complete the bot check to continue"
          : "Captcha verification failed",
      code: required === "interactive" ? "captcha_interactive_required" : "captcha_required",
      captcha: required,
    });
    return false;
  }

  if (required === "interactive" && mode !== "interactive") {
    res.status(400).json({
      error: "Complete the bot check to continue",
      code: "captcha_interactive_required",
      captcha: "interactive",
    });
    return false;
  }

  return true;
}
