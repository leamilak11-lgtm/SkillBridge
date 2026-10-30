import type { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { SESSION_COOKIE, hashToken } from "../auth/session.js";
import { prisma } from "../db.js";
import { forbidden, unauthorized } from "../errors.js";
export async function optionalAuthenticate(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string") return next();
    const session = await prisma.session.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } }, include: { user: true },
    });
    if (session && !session.user.isSuspended) {
      request.auth = { userId: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
    }
    next();
  } catch (error) {
    next(error);
  }
}
export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string") throw unauthorized();
    const session = await prisma.session.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } }, include: { user: true },
    });
    if (!session || session.user.isSuspended) throw unauthorized();
    request.auth = { userId: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
    next();
  } catch (error) {
    next(error);
  }
}
export function allowRoles(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth) return next(unauthorized());
    if (!roles.includes(request.auth.role)) return next(forbidden());
    next();
  };
}
