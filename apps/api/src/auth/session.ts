import { createHmac, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config.js";
import { prisma } from "../db.js";
export const SESSION_COOKIE = "skillbridge_session";
export function hashToken(token: string): string {
  return createHmac("sha256", config.sessionSecret).update(token).digest("hex");
}
export async function createSession(userId: string, response: Response): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax", path: "/", expires: expiresAt,
  });
}
export async function destroySession(request: Request, response: Response): Promise<void> {
  const token = request.cookies?.[SESSION_COOKIE];
  if (typeof token === "string") await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax", path: "/",
  });
}
