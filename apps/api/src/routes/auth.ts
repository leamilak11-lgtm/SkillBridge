import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { createSession, destroySession, hashToken } from "../auth/session.js";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { badRequest, conflict, serviceUnavailable, unauthorized } from "../errors.js";
import { authenticate } from "../middleware/auth.js";
import { requestBody } from "../middleware/validate.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { createRateLimit } from "../middleware/rate-limit.js";

export const authRouter = Router();
const accountAttemptLimit = createRateLimit(config.authRateLimitMax, config.authRateLimitWindowMs);
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(10).max(128);
const phoneSchema = z.string().trim().min(7).max(32).regex(/^\+?[0-9 ()-]+$/).transform((value) => value.replace(/[ ()-]/g, ""));
const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });
const GOOGLE_STATE_COOKIE = "skillbridge_google_state";
const GOOGLE_INTENT_COOKIE = "skillbridge_google_intent";
const googleIntentSchema = z.object({
  role: z.enum(["JOB_SEEKER", "RECRUITER"]).default("JOB_SEEKER"),
  companyName: z.string().trim().min(2).max(180).optional(),
  companyWebsite: z.string().trim().url().max(500).optional().or(z.literal("")),
  companyLocation: z.string().trim().max(180).optional(),
  companyDescription: z.string().trim().max(500).optional(),
}).refine((intent) => intent.role !== "RECRUITER" || Boolean(intent.companyName), {
  path: ["companyName"], message: "Enter a company name to create a recruiter account with Google.",
});
function publicUser(user: { id: string; name: string; username: string; phone: string | null; email: string; role: string; profile: unknown }) {
  return { id: user.id, name: user.name, username: user.username, phone: user.phone, email: user.email, role: user.role, profile: user.profile };
}

function redirectToWeb(path: string) {
  return new URL(path, config.webOrigin).toString();
}

function sameSecret(first: string, second: string) {
  const firstBytes = Buffer.from(first);
  const secondBytes = Buffer.from(second);
  return firstBytes.length === secondBytes.length && timingSafeEqual(firstBytes, secondBytes);
}

authRouter.get("/providers", (_request, response) => {
  response.json({ googleEnabled: config.googleOAuthEnabled });
});

authRouter.post("/register", accountAttemptLimit, async (request, response) => {
  const input = requestBody(request, credentialsSchema.extend({
    name: z.string().trim().min(2).max(120),
    username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/).transform((value) => value.toLowerCase()),
    phone: phoneSchema,
  }));
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: input.email }, { username: input.username }] } });
  if (existing) throw conflict("An account with that email or username already exists.");
  const user = await prisma.user.create({
    data: {
      name: input.name, username: input.username, phone: input.phone, email: input.email, passwordHash: await hashPassword(input.password),
      emailVerifiedAt: new Date(),
      role: "JOB_SEEKER", profile: { create: {} },
    },
    include: { profile: true },
  });
  await createSession(user.id, response);
  response.status(201).json({ user: publicUser(user) });
});

const recruiterRegistrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  companyName: z.string().trim().min(2).max(180),
  companyDescription: z.string().trim().max(3000).optional(),
  companyWebsite: z.string().trim().url().max(500).optional().or(z.literal("")),
  companyLocation: z.string().trim().max(180).optional(),
});
authRouter.post("/register-recruiter", accountAttemptLimit, async (request, response) => {
  const input = requestBody(request, recruiterRegistrationSchema);
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: input.email }, { username: input.username }] } });
  if (existing) throw conflict("An account with that email or username already exists.");
  const user = await prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      phone: input.phone,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      emailVerifiedAt: new Date(),
      role: "RECRUITER",
      memberships: {
        create: {
          isOwner: true,
          company: {
            create: {
              name: input.companyName,
              ...(input.companyDescription ? { description: input.companyDescription } : {}),
              ...(input.companyWebsite ? { website: input.companyWebsite } : {}),
              ...(input.companyLocation ? { location: input.companyLocation } : {}),
            },
          },
        },
      },
    },
    include: { profile: true },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "RECRUITER_ACCOUNT_CREATED", target: input.companyName },
  });
  await createSession(user.id, response);
  response.status(201).json({ user: publicUser(user) });
});

authRouter.get("/google", (request, response) => {
  if (!config.googleOAuthEnabled || !config.googleClientId || !config.googleRedirectUri) {
    throw serviceUnavailable("Google sign-in is not configured.");
  }
  const intentResult = googleIntentSchema.safeParse(request.query);
  if (!intentResult.success) throw badRequest("Enter a valid company name and details before continuing with Google.");
  const intent = intentResult.data;
  const state = randomBytes(32).toString("base64url");
  const encodedIntent = Buffer.from(JSON.stringify(intent)).toString("base64url");
  const cookieOptions = {
    httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax" as const,
    path: "/api/auth/google/callback", maxAge: 10 * 60 * 1000,
  };
  response.cookie(GOOGLE_STATE_COOKIE, state, {
    ...cookieOptions,
  });
  response.cookie(GOOGLE_INTENT_COOKIE, `${encodedIntent}.${hashToken(`${state}.${encodedIntent}`)}`, cookieOptions);
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  response.redirect(authorization.toString());
});

authRouter.get("/google/callback", async (request, response) => {
  const state = typeof request.query.state === "string" ? request.query.state : "";
  const storedState = request.cookies?.[GOOGLE_STATE_COOKIE];
  response.clearCookie(GOOGLE_STATE_COOKIE, {
    httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax", path: "/api/auth/google/callback",
  });
  response.clearCookie(GOOGLE_INTENT_COOKIE, {
    httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax", path: "/api/auth/google/callback",
  });
  if (request.query.error) {
    response.redirect(redirectToWeb("/sign-in?error=google"));
    return;
  }
  if (!state || typeof storedState !== "string" || !sameSecret(state, storedState)) {
    response.redirect(redirectToWeb("/sign-in?error=google"));
    return;
  }
  const intentCookie = request.cookies?.[GOOGLE_INTENT_COOKIE];
  const separator = typeof intentCookie === "string" ? intentCookie.lastIndexOf(".") : -1;
  const encodedIntent = separator > 0 ? intentCookie.slice(0, separator) : "";
  const intentSignature = separator > 0 ? intentCookie.slice(separator + 1) : "";
  if (!encodedIntent || !sameSecret(intentSignature, hashToken(`${state}.${encodedIntent}`))) {
    response.redirect(redirectToWeb("/sign-in?error=google"));
    return;
  }
  let intent: z.infer<typeof googleIntentSchema>;
  try {
    const intentPayload = JSON.parse(Buffer.from(encodedIntent, "base64url").toString("utf8")) as unknown;
    const parsedIntent = googleIntentSchema.safeParse(intentPayload);
    if (!parsedIntent.success) throw new Error("Invalid Google sign-in intent.");
    intent = parsedIntent.data;
  } catch {
    response.redirect(redirectToWeb("/sign-in?error=google"));
    return;
  }
  const code = typeof request.query.code === "string" ? request.query.code : "";
  if (!code || !config.googleOAuthEnabled || !config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    response.redirect(redirectToWeb("/sign-in?error=google"));
    return;
  }
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: config.googleClientId, client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri, grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed.");
    const tokenPayload = await tokenResponse.json() as { access_token?: string };
    if (!tokenPayload.access_token) throw new Error("Google token response was incomplete.");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });
    if (!profileResponse.ok) throw new Error("Google profile lookup failed.");
    const googleProfile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean; name?: string };
    if (!googleProfile.sub || !googleProfile.email || googleProfile.email_verified !== true) throw new Error("Google did not return a verified email.");
    const email = googleProfile.email.trim().toLowerCase();
    const byGoogle = await prisma.user.findUnique({ where: { googleSubject: googleProfile.sub }, include: { profile: true } });
    const user = byGoogle ?? await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    let signedInUser;
    if (user) {
      if (user.isSuspended || (byGoogle && user.email !== email) || (user.googleSubject && user.googleSubject !== googleProfile.sub)) {
        throw new Error("Google account could not be matched.");
      }
      signedInUser = user.emailVerifiedAt && user.googleSubject
        ? user
        : await prisma.user.update({
            where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), googleSubject: googleProfile.sub }, include: { profile: true },
          });
    } else if (intent.role === "RECRUITER" && intent.companyName) {
      const name = (googleProfile.name?.trim() || email.split("@")[0] || "SkillBridge recruiter").slice(0, 120);
      signedInUser = await prisma.user.create({
        data: {
          name, username: "google_" + randomBytes(8).toString("hex"), phone: null,
          email, passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
          emailVerifiedAt: new Date(), googleSubject: googleProfile.sub, role: "RECRUITER",
          memberships: {
            create: {
              isOwner: true,
              company: { create: {
                name: intent.companyName,
                ...(intent.companyWebsite ? { website: intent.companyWebsite } : {}),
                ...(intent.companyLocation ? { location: intent.companyLocation } : {}),
                ...(intent.companyDescription ? { description: intent.companyDescription } : {}),
              } },
            },
          },
        }, include: { profile: true },
      });
      await prisma.auditLog.create({
        data: { actorId: signedInUser.id, action: "RECRUITER_ACCOUNT_CREATED", target: intent.companyName },
      });
    } else {
      const name = (googleProfile.name?.trim() || email.split("@")[0] || "SkillBridge user").slice(0, 120);
      signedInUser = await prisma.user.create({
        data: {
          name, username: "google_" + randomBytes(8).toString("hex"), phone: null,
          email, passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
          emailVerifiedAt: new Date(), googleSubject: googleProfile.sub, role: "JOB_SEEKER", profile: { create: {} },
        }, include: { profile: true },
      });
    }
    await createSession(signedInUser.id, response);
    response.redirect(redirectToWeb("/auth/callback"));
  } catch {
    response.redirect(redirectToWeb("/sign-in?error=google"));
  }
});

authRouter.post("/login", accountAttemptLimit, async (request, response) => {
  const input = requestBody(request, credentialsSchema);
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: { profile: true } });
  if (!user || user.isSuspended || !(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthorized("Email or password is incorrect.");
  }
  await createSession(user.id, response);
  response.json({ user: publicUser(user) });
});

authRouter.post("/logout", async (request, response) => {
  await destroySession(request, response);
  response.status(204).end();
});

authRouter.get("/me", authenticate, async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.auth!.userId }, include: { profile: true } });
  if (!user) throw unauthorized();
  response.json({ user: publicUser(user) });
});

const resetRequestSchema = z.object({
  username: z.string().trim().min(3).max(40).transform((value) => value.toLowerCase()),
  email: emailSchema,
  phone: phoneSchema,
  newPassword: passwordSchema,
});
authRouter.post("/password-reset/request", accountAttemptLimit, async (request, response) => {
  const input = requestBody(request, resetRequestSchema);
  const user = await prisma.user.findFirst({
    where: { username: input.username, email: input.email, phone: input.phone },
  });
  if (!user || user.isSuspended) throw unauthorized("The username, email, or phone number did not match this account.");
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  response.json({ message: "Your password has been updated. Sign in with your new password." });
});
