import { ApplicationStatus, EmploymentType, Prisma, UserRole, WorkArrangement } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { conflict, forbidden, notFound } from "../errors.js";
import { allowRoles, authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { requestBody, routeParam } from "../middleware/validate.js";
import { explainMatch, normalizeSkill } from "../services/matching.js";
import { notifyCompanyRecruiters } from "../services/notifications.js";

export const jobsRouter = Router();
const jobInclude = {
  company: { select: { id: true, name: true, location: true, website: true, isDemo: true } },
  skills: { include: { skill: { select: { id: true, name: true, category: true } } } },
} as const;
function publicJob(job: any, profile?: any) {
  const {
    id, title, location, workArrangement, employmentType, industry, description, responsibilities,
    experienceMinYears, experienceMaxYears, salaryMin, salaryMax, salaryCurrency, applicationDeadline,
    isDemo, publishedAt, createdAt, company, skills,
  } = job;
  return {
    id, title, location, workArrangement, employmentType, industry, description, responsibilities,
    experienceMinYears, experienceMaxYears, salaryMin, salaryMax, salaryCurrency, applicationDeadline,
    isDemo, publishedAt, createdAt, company,
    skills: skills.map((item: any) => ({ name: item.skill.name, category: item.skill.category, required: item.required })),
    ...(profile ? { match: explainMatch(profile, job) } : {}),
  };
}
async function seekerProfile(userId?: string) {
  if (!userId) return null;
  return prisma.seekerProfile.findUnique({
    where: { userId },
    include: { skills: { include: { skill: true } }, experiences: true },
  });
}
const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  location: z.string().trim().max(180).optional(),
  workArrangement: z.nativeEnum(WorkArrangement).optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  skill: z.string().trim().max(100).optional(),
  company: z.string().trim().max(180).optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  salaryMax: z.coerce.number().int().min(0).optional(),
  experienceMax: z.coerce.number().min(0).max(60).optional(),
  postedWithin: z.enum(["24h", "7d", "30d"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
jobsRouter.get("/", optionalAuthenticate, async (request, response) => {
  const query = listQuery.parse(request.query);
  const and: Prisma.JobWhereInput[] = [];
  if (query.q) and.push({ OR: [
    { title: { contains: query.q, mode: "insensitive" } },
    { description: { contains: query.q, mode: "insensitive" } },
    { company: { name: { contains: query.q, mode: "insensitive" } } },
  ] });
  if (query.location) and.push({ location: { contains: query.location, mode: "insensitive" } });
  if (query.workArrangement) and.push({ workArrangement: query.workArrangement });
  if (query.employmentType) and.push({ employmentType: query.employmentType });
  if (query.skill) and.push({ skills: { some: { skill: { normalized: normalizeSkill(query.skill) } } } });
  if (query.company) and.push({ company: { name: { contains: query.company, mode: "insensitive" } } });
  if (query.salaryMin !== undefined) and.push({ OR: [
    { salaryMax: { gte: query.salaryMin } },
    { salaryMax: null, salaryMin: { gte: query.salaryMin } },
  ] });
  if (query.salaryMax !== undefined) and.push({ OR: [
    { salaryMin: { lte: query.salaryMax } },
    { salaryMin: null, salaryMax: { lte: query.salaryMax } },
  ] });
  if (query.experienceMax !== undefined) and.push({ OR: [{ experienceMinYears: null }, { experienceMinYears: { lte: query.experienceMax } }] });
  if (query.postedWithin) {
    const days = query.postedWithin === "24h" ? 1 : query.postedWithin === "7d" ? 7 : 30;
    and.push({ publishedAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } });
  }
  const where = { status: "PUBLISHED" as const, company: { isApproved: true, isSuspended: false }, ...(and.length ? { AND: and } : {}) };
  const auth = request.auth;
  const [items, total, profile] = await Promise.all([
    prisma.job.findMany({ where, include: jobInclude, orderBy: { publishedAt: "desc" }, skip: (query.page - 1) * 20, take: 20 }),
    prisma.job.count({ where }),
    auth?.role === UserRole.JOB_SEEKER ? seekerProfile(auth.userId) : null,
  ]);
  response.json({ jobs: items.map((item) => publicJob(item, profile ?? undefined)), page: query.page, pageSize: 20, total });
});

jobsRouter.get("/:id", optionalAuthenticate, async (request, response) => {
  const id = routeParam(request, "id");
  const job = await prisma.job.findFirst({
    where: { id, status: "PUBLISHED", company: { isApproved: true, isSuspended: false } },
    include: { ...jobInclude, _count: { select: { savedBy: true, applications: true } } },
  });
  if (!job) throw notFound("Job not found.");
  const auth = request.auth;
  const seekerUserId = auth?.role === UserRole.JOB_SEEKER ? auth.userId : undefined;
  const profile = await seekerProfile(seekerUserId);
  const saved = seekerUserId
    ? Boolean(await prisma.savedJob.findUnique({ where: { userId_jobId: { userId: seekerUserId, jobId: job.id } }, select: { id: true } }))
    : false;
  const applied = seekerUserId
    ? Boolean(await prisma.application.findUnique({ where: { userId_jobId: { userId: seekerUserId, jobId: job.id } }, select: { id: true } }))
    : false;
  response.json({ job: publicJob(job, profile ?? undefined), saved, applied });
});

jobsRouter.post("/:id/save", authenticate, allowRoles(UserRole.JOB_SEEKER), async (request, response) => {
  const job = await prisma.job.findFirst({ where: { id: routeParam(request, "id"), status: "PUBLISHED", company: { isApproved: true, isSuspended: false } } });
  if (!job) throw notFound("Job not found.");
  const saved = await prisma.savedJob.upsert({
    where: { userId_jobId: { userId: request.auth!.userId, jobId: job.id } },
    update: {},
    create: { userId: request.auth!.userId, jobId: job.id },
  });
  response.status(201).json({ saved: { id: saved.id, jobId: saved.jobId, createdAt: saved.createdAt } });
});
jobsRouter.delete("/:id/save", authenticate, allowRoles(UserRole.JOB_SEEKER), async (request, response) => {
  await prisma.savedJob.deleteMany({ where: { userId: request.auth!.userId, jobId: routeParam(request, "id") } });
  response.status(204).end();
});

const applySchema = z.object({
  resumeId: z.string().uuid().nullable().optional(),
  coverLetter: z.string().trim().max(5000).nullable().optional(),
});
jobsRouter.post("/:id/apply", authenticate, allowRoles(UserRole.JOB_SEEKER), async (request, response) => {
  const input = requestBody(request, applySchema);
  const job = await prisma.job.findFirst({ where: { id: routeParam(request, "id"), status: "PUBLISHED", company: { isApproved: true, isSuspended: false } } });
  if (!job) throw notFound("Job not found.");
  if (input.resumeId) {
    const resume = await prisma.resume.findFirst({ where: { id: input.resumeId, userId: request.auth!.userId } });
    if (!resume) throw forbidden("Choose a resume from your own account.");
  }
  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId: request.auth!.userId, jobId: job.id } },
  });
  if (existing) throw conflict("You have already applied to this job.");
  const application = await prisma.$transaction(async (tx) => {
    const created = await tx.application.create({
      data: {
        userId: request.auth!.userId, jobId: job.id, resumeId: input.resumeId ?? null,
        coverLetter: input.coverLetter || null, status: ApplicationStatus.APPLIED,
      },
      select: { id: true, userId: true, jobId: true, status: true, submittedAt: true },
    });
    await tx.applicationStatusHistory.create({
      data: { applicationId: created.id, status: ApplicationStatus.APPLIED, changedById: request.auth!.userId },
    });
    await notifyCompanyRecruiters(tx, job.companyId, "New application", "A candidate applied for " + job.title + ".");
    return created;
  });
  response.status(201).json({ application });
});
