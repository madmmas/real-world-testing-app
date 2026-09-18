import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "./env.js";

const transporter =
  env.smtpHost &&
  nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: false,
  });

export function newResetToken() {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendPasswordResetMail(to: string, token: string) {
  if (!transporter) {
    console.warn("SMTP_HOST unset; skip password-reset mail");
    return;
  }
  const resetUrl = `${env.webOrigin.replace(/\/$/, "")}/reset?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject: "Reset your Books Library password",
    text: `Reset your password (valid 1 hour):\n${resetUrl}\n`,
    html: `<p>Reset your password (valid 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
}
