import { ApplicationStatus, JobStatus, Prisma, UserRole, WorkArrangement, EmploymentType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { requestBody, routeParam } from "../middleware/validate.js";
import { explainMatch, normalizeSkill } from "../services/matching.js";
import { privateStorage } from "../services/private-storage.js";
import { notifyUser } from "../services/notifications.js";

export const recruiterRouter = Router();
recruiterRouter.use(authenticate, allowRoles(UserRole.RECRUITER));

const companyInclude = {
  members: { select: { userId: true, isOwner: true } },
} as const;
async function recruiterCompany(userId: string, ownerOnly = false) {
  const company = await prisma.company.findFirst({
    where: {
      members: { some: { userId, ...(ownerOnly ? { isOwner: true } : {}) } },
    },
    include: companyInclude,
    orderBy: { createdAt: "asc" },
  });
  if (!company) throw forbidden("Your recruiter account is not connected to a company.");
  if (company.isSuspended) throw forbidden("This company account is suspended. Contact SkillBridge support.");
  return company;
}

recruiterRouter.get("/candidates", async (request, response) => {
  const company = await recruiterCompany(request.auth!.userId);
  if (!company.isApproved) throw forbidden("Your company must be approved before candidate discovery is available.");
  const query = z.object({
    q: z.string().trim().max(120).optional(),
    skill: z.string().trim().max(100).optional(),
    jobId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  }).parse(request.query);
  const selectedJob = query.jobId ? await prisma.job.findFirst({
    where: { id: query.jobId, companyId: company.id },
    select: {
      id: true, title: true, location: true, workArrangement: true, employmentType: true, industry: true,
      experienceMinYears: true,
      skills: { select: { required: true, skill: { select: { name: true } } } },
    },
  }) : null;
  if (query.jobId && !selectedJob) throw notFound("Job not found in your company workspace.");
  const and: Prisma.SeekerProfileWhereInput[] = [
    { visibilityPublic: true },
    { user: { is: { role: UserRole.JOB_SEEKER, isSuspended: false } } },
  ];
  if (query.skill) and.push({ skills: { some: { skill: { normalized: normalizeSkill(query.skill) } } } });
  if (query.q) and.push({ OR: [
    { headline: { contains: query.q, mode: "insensitive" } },
    { location: { contains: query.q, mode: "insensitive" } },
    { user: { is: { name: { contains: query.q, mode: "insensitive" } } } },
    { desiredRoles: { has: query.q } },
  ] });
  const where: Prisma.SeekerProfileWhereInput = { AND: and };
  const candidateSelect = {
        id: true, headline: true, location: true, biography: true, desiredRoles: true,
        user: { select: { id: true, name: true } },
        skills: { select: { level: true, yearsExperience: true, evidence: true, skill: { select: { name: true, category: true } } }, orderBy: { skill: { name: "asc" } } },
        experiences: { select: { title: true, company: true, description: true, startDate: true, endDate: true, isCurrent: true }, orderBy: { startDate: "desc" }, take: 5 },
  } as const;
  if (selectedJob) {
    const [pool, filteredTotal] = await Promise.all([
      prisma.seekerProfile.findMany({ where, select: candidateSelect, orderBy: { updatedAt: "desc" }, take: 500 }),
      prisma.seekerProfile.count({ where }),
    ]);
    const ranked = pool.map((candidate) => ({
      candidate,
      match: explainMatch({
        headline: candidate.headline,
        location: candidate.location,
        desiredRoles: candidate.desiredRoles,
        skills: candidate.skills,
        experiences: candidate.experiences,
      }, selectedJob),
    })).sort((a, b) => (b.match.score ?? -1) - (a.match.score ?? -1));
    const offset = (query.page - 1) * 20;
    response.json({
      candidates: ranked.slice(offset, offset + 20).map(({ candidate, match }) => ({ ...candidate, match })),
      page: query.page, pageSize: 20, total: Math.min(filteredTotal, 500),
      matchPoolLimited: filteredTotal > 500,
      contactDetailsIncluded: false,
    });
    return;
  }
  const [candidates, total] = await Promise.all([
    prisma.seekerProfile.findMany({ where, select: candidateSelect, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * 20, take: 20 }),
    prisma.seekerProfile.count({ where }),
  ]);
  response.json({ candidates, page: query.page, pageSize: 20, total, matchPoolLimited: false, contactDetailsIncluded: false });
});
function companyView(company: Awaited<ReturnType<typeof recruiterCompany>>) {
  const { members, ...details } = company;
  return { ...details, isOwner: members.some((member) => member.isOwner) };
}

recruiterRouter.get("/company", async (request, response) => {
  response.json({ company: companyView(await recruiterCompany(request.auth!.userId)) });
});

const companyUpdateSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  website: z.string().trim().url().max(500).nullable().optional(),
  location: z.string().trim().max(180).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "Add at least one company detail to update.");
recruiterRouter.patch("/company", async (request, response) => {
  const input = requestBody(request, companyUpdateSchema);
  const company = await recruiterCompany(request.auth!.userId, true);
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
    },
  });
  response.json({ company: { ...updated, isOwner: true } });
});

const skillInput = z.object({ name: z.string().trim().min(1).max(100), required: z.boolean().default(true) });
const jobInput = z.object({
  title: z.string().trim().min(1).max(180),
  location: z.string().trim().max(180).nullable().optional(),
  workArrangement: z.nativeEnum(WorkArrangement),
  employmentType: z.nativeEnum(EmploymentType),
  industry: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().min(1).max(10000),
  responsibilities: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  experienceMinYears: z.number().min(0).max(60).nullable().optional(),
  experienceMaxYears: z.number().min(0).max(60).nullable().optional(),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  salaryCurrency: z.string().trim().length(3).toUpperCase().nullable().optional(),
  applicationDeadline: z.string().datetime({ offset: true }).nullable().optional(),
  skills: z.array(skillInput).max(30).default([]),
}).refine((value) => value.experienceMinYears == null || value.experienceMaxYears == null || value.experienceMinYears <= value.experienceMaxYears, {
  path: ["experienceMaxYears"], message: "Maximum experience must be at least the minimum.",
}).refine((value) => value.salaryMin == null || value.salaryMax == null || value.salaryMin <= value.salaryMax, {
  path: ["salaryMax"], message: "Maximum salary must be at least the minimum.",
});
type JobInput = z.infer<typeof jobInput>;
const jobInclude = {
  company: { select: { id: true, name: true, location: true, isApproved: true, isDemo: true } },
  skills: { include: { skill: { select: { id: true, name: true, category: true } } } },
  _count: { select: { applications: true } },
} as const;
function jobFields(input: JobInput) {
  return {
    title: input.title,
    location: input.location || null,
    workArrangement: input.workArrangement,
    employmentType: input.employmentType,
    industry: input.industry || null,
    description: input.description,
    responsibilities: input.responsibilities,
    experienceMinYears: input.experienceMinYears ?? null,
    experienceMaxYears: input.experienceMaxYears ?? null,
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    salaryCurrency: input.salaryCurrency || null,
    applicationDeadline: input.applicationDeadline ? new Date(input.applicationDeadline) : null,
  };
}
async function replaceSkills(tx: Prisma.TransactionClient, jobId: string, input: JobInput) {
  await tx.jobSkill.deleteMany({ where: { jobId } });
  const seen = new Set<string>();
  for (const item of input.skills) {
    const normalized = normalizeSkill(item.name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const skill = await tx.skill.upsert({
      where: { normalized },
      update: {},
      create: { name: item.name, normalized },
      select: { id: true },
    });
    await tx.jobSkill.create({ data: { jobId, skillId: skill.id, required: item.required } });
  }
}
async function ownedJob(userId: string, id: string) {
  const company = await recruiterCompany(userId);
  const job = await prisma.job.findFirst({ where: { id, companyId: company.id }, include: jobInclude });
  if (!job) throw notFound("Job not found in your company workspace.");
  return { company, job };
}

recruiterRouter.get("/jobs", async (request, response) => {
  const company = await recruiterCompany(request.auth!.userId);
  const jobs = await prisma.job.findMany({
    where: { companyId: company.id }, include: jobInclude, orderBy: { updatedAt: "desc" },
  });
  response.json({ company: companyView(company), jobs });
});
recruiterRouter.post("/jobs", async (request, response) => {
  const input = requestBody(request, jobInput);
  const company = await recruiterCompany(request.auth!.userId);
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: {
        ...jobFields(input), companyId: company.id, createdById: request.auth!.userId,
        status: JobStatus.DRAFT,
      },
      select: { id: true },
    });
    await replaceSkills(tx, created.id, input);
    return tx.job.findUniqueOrThrow({ where: { id: created.id }, include: jobInclude });
  });
  response.status(201).json({ job });
});
recruiterRouter.patch("/jobs/:id", async (request, response) => {
  const input = requestBody(request, jobInput);
  const { job } = await ownedJob(request.auth!.userId, routeParam(request, "id"));
  const updated = await prisma.$transaction(async (tx) => {
    await tx.job.update({ where: { id: job.id }, data: jobFields(input) });
    await replaceSkills(tx, job.id, input);
    return tx.job.findUniqueOrThrow({ where: { id: job.id }, include: jobInclude });
  });
  response.json({ job: updated });
});
recruiterRouter.patch("/jobs/:id/status", async (request, response) => {
  const input = requestBody(request, z.object({ status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]) }));
  const { company, job } = await ownedJob(request.auth!.userId, routeParam(request, "id"));
  if (input.status === "PUBLISHED") {
    if (!company.isApproved) throw forbidden("Your company needs approval before jobs can be published.");
    if (!job.title.trim() || job.description.trim().length < 30 || !job.skills.length) {
      throw badRequest("Add a job title, a useful description, and at least one skill before publishing.");
    }
    if (job.applicationDeadline && job.applicationDeadline < new Date()) throw badRequest("Choose a future application deadline.");
  }
  const updated = await prisma.job.update({
    where: { id: job.id },
    data: {
      status: input.status,
      ...(input.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
    },
    include: jobInclude,
  });
  response.json({ job: updated });
});
recruiterRouter.delete("/jobs/:id", async (request, response) => {
  const { job } = await ownedJob(request.auth!.userId, routeParam(request, "id"));
  if (job.status !== JobStatus.DRAFT || job._count.applications > 0) {
    throw conflict("Only a draft job with no applications can be deleted. Close published roles instead.");
  }
  await prisma.job.delete({ where: { id: job.id } });
  response.status(204).end();
});

const recruiterApplications = {
  id: true, status: true, coverLetter: true, recruiterNotes: true, submittedAt: true, updatedAt: true,
  resume: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
  user: { select: { id: true, name: true } },
  job: { select: { id: true, title: true } },
  history: { select: { status: true, note: true, createdAt: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ApplicationSelect;
recruiterRouter.get("/applications", async (request, response) => {
  const company = await recruiterCompany(request.auth!.userId);
  const applications = await prisma.application.findMany({
    where: { job: { companyId: company.id } },
    select: recruiterApplications,
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
  response.json({ applications });
});
const recruiterStatus = z.enum(["UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"]);
recruiterRouter.patch("/applications/:id", async (request, response) => {
  const input = requestBody(request, z.object({
    status: recruiterStatus.optional(),
    recruiterNotes: z.string().trim().max(4000).nullable().optional(),
  }).refine((value) => value.status !== undefined || value.recruiterNotes !== undefined, "Add a status or note to update."));
  const company = await recruiterCompany(request.auth!.userId);
  const existing = await prisma.application.findFirst({
    where: { id: routeParam(request, "id"), job: { companyId: company.id } }, include: { job: { select: { title: true } } },
  });
  if (!existing) throw notFound("Application not found in your company workspace.");
  if (input.status && input.status !== existing.status) {
    if (existing.status === ApplicationStatus.WITHDRAWN || existing.status === ApplicationStatus.REJECTED) {
      throw conflict("This application is closed and its status cannot be changed.");
    }
    const nextAllowed: Record<string, string[]> = {
      APPLIED: ["UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"],
      UNDER_REVIEW: ["INTERVIEW", "OFFER", "REJECTED"],
      INTERVIEW: ["OFFER", "REJECTED"],
      OFFER: [],
    };
    if (!nextAllowed[existing.status]?.includes(input.status)) throw conflict("That application status change is not allowed.");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const application = await tx.application.update({
      where: { id: existing.id },
      data: {
        ...(input.status ? { status: input.status as ApplicationStatus } : {}),
        ...(input.recruiterNotes !== undefined ? { recruiterNotes: input.recruiterNotes || null } : {}),
      },
      select: recruiterApplications,
    });
    if (input.status && input.status !== existing.status) {
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: existing.id,
          status: input.status as ApplicationStatus,
          changedById: request.auth!.userId,
        },
      });
      await notifyUser(tx, existing.userId, "Application update", `Your application for ${existing.job.title} is now ${input.status.replaceAll("_", " ").toLowerCase()}.`);
    }
    return application;
  });
  response.json({ application: updated });
});
recruiterRouter.get("/applications/:id/resume", async (request, response) => {
  const company = await recruiterCompany(request.auth!.userId);
  const application = await prisma.application.findFirst({
    where: { id: routeParam(request, "id"), job: { companyId: company.id } },
    select: { resume: { select: { originalName: true, mimeType: true, storageKey: true } } },
  });
  if (!application) throw notFound("Application not found in your company workspace.");
  if (!application.resume) throw notFound("The applicant did not attach a resume.");
  const bytes = await privateStorage.get(application.resume.storageKey);
  response.type(application.resume.mimeType).attachment(application.resume.originalName).send(bytes);
});
