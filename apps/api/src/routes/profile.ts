import { EmploymentType, SkillLevel, SkillSource, UserRole, WorkArrangement } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { requestBody } from "../middleware/validate.js";
import { normalizeSkill } from "../services/matching.js";
import { getProfile } from "../services/profile.js";
import { newAvatarStorageKey, privateStorage } from "../services/private-storage.js";
import { verifyPassword } from "../security/password.js";

export const profileRouter = Router();
const avatarTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, avatarTypes.has(file.mimetype)),
});
const dateField = z.string().datetime().optional().or(z.literal(""));
const skillSchema = z.object({
  name: z.string().trim().min(1).max(100),
  level: z.nativeEnum(SkillLevel).optional(),
  yearsExperience: z.number().min(0).max(60).nullable().optional(),
  evidence: z.string().trim().max(1000).nullable().optional(),
});
const experienceSchema = z.object({
  title: z.string().trim().min(1).max(180),
  company: z.string().trim().min(1).max(180),
  location: z.string().trim().max(180).nullable().optional(),
  description: z.string().trim().min(1).max(4000),
  startDate: dateField,
  endDate: dateField,
  isCurrent: z.boolean().default(false),
});
const educationSchema = z.object({
  institution: z.string().trim().min(1).max(180),
  qualification: z.string().trim().max(180).nullable().optional(),
  field: z.string().trim().max(180).nullable().optional(),
  startDate: dateField,
  endDate: dateField,
  description: z.string().trim().max(2000).nullable().optional(),
});
const projectSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(3000),
  url: z.string().url().max(500).nullable().optional(),
  startDate: dateField,
  endDate: dateField,
});
const certificationSchema = z.object({
  name: z.string().trim().min(1).max(180),
  issuer: z.string().trim().min(1).max(180),
  issuedAt: dateField,
  expiresAt: dateField,
  credentialUrl: z.string().url().max(500).nullable().optional(),
});
const languageSchema = z.object({
  name: z.string().trim().min(1).max(80),
  proficiency: z.string().trim().max(40).nullable().optional(),
});
const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  headline: z.string().trim().max(180).nullable().optional(),
  location: z.string().trim().max(180).nullable().optional(),
  biography: z.string().trim().max(3000).nullable().optional(),
  desiredRoles: z.array(z.string().trim().min(1).max(180)).max(20).default([]),
  desiredIndustries: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  preferredLocations: z.array(z.string().trim().min(1).max(180)).max(20).default([]),
  workArrangements: z.array(z.nativeEnum(WorkArrangement)).max(3).default([]),
  employmentTypes: z.array(z.nativeEnum(EmploymentType)).max(5).default([]),
  salaryMin: z.number().int().min(0).max(1000000000).nullable().optional(),
  salaryMax: z.number().int().min(0).max(1000000000).nullable().optional(),
  salaryCurrency: z.string().trim().length(3).nullable().optional(),
  skills: z.array(skillSchema).max(80).default([]),
  experiences: z.array(experienceSchema).max(50).default([]),
  education: z.array(educationSchema).max(30).default([]),
  projects: z.array(projectSchema).max(50).default([]),
  certifications: z.array(certificationSchema).max(50).default([]),
  languages: z.array(languageSchema).max(30).default([]),
}).refine((value) => value.salaryMin == null || value.salaryMax == null || value.salaryMin <= value.salaryMax, {
  path: ["salaryMin"],
  message: "Minimum salary must not exceed maximum salary.",
});

function asDate(value?: string) {
  return value ? new Date(value) : null;
}
function orNull<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

profileRouter.use(authenticate, allowRoles(UserRole.JOB_SEEKER));
profileRouter.get("/avatar", async (request, response) => {
  const profile = await prisma.seekerProfile.findUnique({
    where: { userId: request.auth!.userId },
    select: { avatarStorageKey: true, avatarMimeType: true },
  });
  if (!profile?.avatarStorageKey || !profile.avatarMimeType) throw notFound("Profile photo not found.");
  const image = await privateStorage.get(profile.avatarStorageKey);
  response.set({ "Cache-Control": "private, no-store", "Content-Length": String(image.length), "X-Content-Type-Options": "nosniff" });
  response.type(profile.avatarMimeType).send(image);
});

profileRouter.post("/avatar", avatarUpload.single("avatar"), async (request, response) => {
  const file = request.file;
  const extension = file && avatarTypes.get(file.mimetype);
  if (!file || !extension || !validAvatarSignature(file.buffer, file.mimetype)) {
    throw badRequest("Choose a valid PNG, JPEG, or WebP image under 2 MB.");
  }
  const userId = request.auth!.userId;
  const previous = await prisma.seekerProfile.findUnique({
    where: { userId }, select: { avatarStorageKey: true },
  });
  if (!previous) throw notFound("Seeker profile not found.");
  const storageKey = newAvatarStorageKey(extension as "jpg" | "png" | "webp");
  await privateStorage.put(storageKey, file.mimetype, file.buffer);
  try {
    await prisma.seekerProfile.update({
      where: { userId }, data: { avatarStorageKey: storageKey, avatarMimeType: file.mimetype },
    });
  } catch (error) {
    await privateStorage.remove(storageKey).catch(() => undefined);
    throw error;
  }
  if (previous.avatarStorageKey) await privateStorage.remove(previous.avatarStorageKey).catch(() => undefined);
  response.json({ avatarUrl: "/api/profile/avatar" });
});

profileRouter.delete("/avatar", async (request, response) => {
  const profile = await prisma.seekerProfile.findUnique({
    where: { userId: request.auth!.userId }, select: { avatarStorageKey: true },
  });
  if (profile?.avatarStorageKey) {
    await prisma.seekerProfile.update({
      where: { userId: request.auth!.userId }, data: { avatarStorageKey: null, avatarMimeType: null },
    });
    await privateStorage.remove(profile.avatarStorageKey).catch(() => undefined);
  }
  response.status(204).end();
});

profileRouter.get("/", async (request, response) => {
  response.json(await getProfile(request.auth!.userId));
});

profileRouter.put("/", async (request, response) => {
  const input = requestBody(request, profileSchema);
  const userId = request.auth!.userId;
  const profile = await prisma.seekerProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound("Seeker profile not found.");
  const priorSkills = await prisma.userSkill.findMany({ where: { profileId: profile.id }, select: { skillId: true, source: true } });
  const skills = await Promise.all(input.skills.map(async (item) => {
    const normalized = normalizeSkill(item.name);
    const skill = await prisma.skill.upsert({
      where: { normalized },
      update: {},
      create: { name: item.name, normalized, category: "General" },
    });
    const prior = priorSkills.find((candidate) => candidate.skillId === skill.id);
    return { ...item, skillId: skill.id, source: prior?.source === SkillSource.USER_CONFIRMED ? SkillSource.USER_CONFIRMED : SkillSource.USER_ENTERED };
  }));
  await prisma.$transaction(async (tx) => {
    if (input.name) await tx.user.update({ where: { id: userId }, data: { name: input.name } });
    await tx.seekerProfile.update({
      where: { userId },
      data: {
        headline: orNull(input.headline),
        location: orNull(input.location),
        biography: orNull(input.biography),
        desiredRoles: input.desiredRoles,
        desiredIndustries: input.desiredIndustries,
        preferredLocations: input.preferredLocations,
        workArrangements: input.workArrangements,
        employmentTypes: input.employmentTypes,
        salaryMin: orNull(input.salaryMin),
        salaryMax: orNull(input.salaryMax),
        salaryCurrency: input.salaryCurrency?.toUpperCase() ?? null,
      },
    });
    await tx.userSkill.deleteMany({ where: { profileId: profile.id } });
    if (skills.length) {
      await tx.userSkill.createMany({
        data: skills.map((item) => ({
          profileId: profile.id, skillId: item.skillId, level: item.level ?? null,
          yearsExperience: item.yearsExperience ?? null, evidence: item.evidence ?? null,
          source: item.source,
        })),
      });
    }
    await tx.experience.deleteMany({ where: { profileId: profile.id } });
    if (input.experiences.length) {
      await tx.experience.createMany({ data: input.experiences.map((item) => ({
        profileId: profile.id, title: item.title, company: item.company, location: item.location ?? null,
        description: item.description, startDate: asDate(item.startDate), endDate: asDate(item.endDate), isCurrent: item.isCurrent,
        source: SkillSource.USER_ENTERED,
      })) });
    }
    await tx.education.deleteMany({ where: { profileId: profile.id } });
    if (input.education.length) {
      await tx.education.createMany({ data: input.education.map((item) => ({
        profileId: profile.id, institution: item.institution, qualification: item.qualification ?? null,
        field: item.field ?? null, startDate: asDate(item.startDate), endDate: asDate(item.endDate),
        description: item.description ?? null, source: SkillSource.USER_ENTERED,
      })) });
    }
    await tx.project.deleteMany({ where: { profileId: profile.id } });
    if (input.projects.length) {
      await tx.project.createMany({ data: input.projects.map((item) => ({
        profileId: profile.id, name: item.name, description: item.description, url: item.url ?? null,
        startDate: asDate(item.startDate), endDate: asDate(item.endDate), source: SkillSource.USER_ENTERED,
      })) });
    }
    await tx.certification.deleteMany({ where: { profileId: profile.id } });
    if (input.certifications.length) {
      await tx.certification.createMany({ data: input.certifications.map((item) => ({
        profileId: profile.id, name: item.name, issuer: item.issuer, issuedAt: asDate(item.issuedAt),
        expiresAt: asDate(item.expiresAt), credentialUrl: item.credentialUrl ?? null, source: SkillSource.USER_ENTERED,
      })) });
    }
    await tx.language.deleteMany({ where: { profileId: profile.id } });
    if (input.languages.length) {
      await tx.language.createMany({ data: input.languages.map((item) => ({
        profileId: profile.id, name: item.name, proficiency: item.proficiency ?? null,
      })) });
    }
  });
  response.json(await getProfile(userId));
});

profileRouter.patch("/privacy", async (request, response) => {
  const input = requestBody(request, z.object({ visibilityPublic: z.boolean() }));
  const profile = await prisma.seekerProfile.update({
    where: { userId: request.auth!.userId }, data: { visibilityPublic: input.visibilityPublic },
    select: { visibilityPublic: true },
  });
  response.json({ privacy: profile });
});

profileRouter.delete("/account", async (request, response) => {
  const input = requestBody(request, z.object({ password: z.string().min(1).max(128) }));
  const user = await prisma.user.findUnique({ where: { id: request.auth!.userId } });
  if (!user) throw notFound("Account not found.");
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw forbidden("Password confirmation did not match.");
  const resumes = await prisma.resume.findMany({ where: { userId: user.id }, select: { storageKey: true } });
  for (const resume of resumes) await privateStorage.remove(resume.storageKey);
  const profile = await prisma.seekerProfile.findUnique({ where: { userId: user.id }, select: { avatarStorageKey: true } });
  if (profile?.avatarStorageKey) await privateStorage.remove(profile.avatarStorageKey);
  await prisma.user.delete({ where: { id: user.id } });
  response.clearCookie("skillbridge_session", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  response.status(204).end();
});

function validAvatarSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
}
