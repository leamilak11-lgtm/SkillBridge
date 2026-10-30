import { JobStatus, ReportStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { requestBody, routeParam } from "../middleware/validate.js";

export const adminRouter = Router();
adminRouter.use(authenticate, allowRoles(UserRole.ADMIN));

adminRouter.get("/overview", async (_request, response) => {
  const [users, seekers, recruiters, companiesPending, jobsPending, publishedJobs, applications, openReports] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.JOB_SEEKER } }),
    prisma.user.count({ where: { role: UserRole.RECRUITER } }),
    prisma.company.count({ where: { isApproved: false } }),
    prisma.job.count({ where: { status: JobStatus.DRAFT } }),
    prisma.job.count({ where: { status: JobStatus.PUBLISHED } }),
    prisma.application.count(),
    prisma.report.count({ where: { status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] } } }),
  ]);
  response.json({ overview: { users, seekers, recruiters, companiesPending, jobsPending, publishedJobs, applications, openReports } });
});

adminRouter.get("/companies", async (_request, response) => {
  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { members: true, jobs: true, reports: true } },
      members: { where: { isOwner: true }, select: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  response.json({ companies });
});
adminRouter.patch("/companies/:id", async (request, response) => {
  const input = requestBody(request, z.object({
    isApproved: z.boolean().optional(),
    isSuspended: z.boolean().optional(),
    reason: z.string().trim().min(8).max(1000).optional(),
  }).refine((value) => value.isApproved !== undefined || value.isSuspended !== undefined, "Choose a company action.")
    .refine((value) => !(value.isApproved === false || value.isSuspended === true) || Boolean(value.reason), "Add a reason when revoking approval or suspending a company."));
  const id = routeParam(request, "id");
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) throw notFound("Company not found.");
  const changes: Array<{ action: string; reason: string }> = [];
  if (input.isApproved !== undefined && input.isApproved !== existing.isApproved) {
    changes.push({ action: input.isApproved ? "COMPANY_APPROVED" : "COMPANY_APPROVAL_REVOKED", reason: input.reason || (input.isApproved ? "Company approved by an administrator." : "Company approval revoked by an administrator.") });
  }
  if (input.isSuspended !== undefined && input.isSuspended !== existing.isSuspended) {
    changes.push({ action: input.isSuspended ? "COMPANY_SUSPENDED" : "COMPANY_REINSTATED", reason: input.reason || (input.isSuspended ? "Company suspended by an administrator." : "Company reinstated by an administrator.") });
  }
  const company = await prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({
      where: { id },
      data: {
        ...(input.isApproved !== undefined ? { isApproved: input.isApproved } : {}),
        ...(input.isSuspended !== undefined ? { isSuspended: input.isSuspended } : {}),
      },
    });
    for (const change of changes) {
      await tx.moderationAction.create({
        data: { actorId: request.auth!.userId, targetType: "COMPANY", targetId: id, action: change.action, reason: change.reason },
      });
      await tx.auditLog.create({
        data: { actorId: request.auth!.userId, action: change.action, target: id, metadata: { companyName: existing.name } },
      });
    }
    return updated;
  });
  response.json({ company });
});

adminRouter.get("/jobs", async (_request, response) => {
  const jobs = await prisma.job.findMany({
    include: { company: { select: { id: true, name: true, isApproved: true, isSuspended: true } }, _count: { select: { applications: true, reports: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  response.json({ jobs });
});
adminRouter.patch("/jobs/:id/status", async (request, response) => {
  const input = requestBody(request, z.object({ status: z.nativeEnum(JobStatus), reason: z.string().trim().min(8).max(1000).optional() })
    .refine((value) => value.status !== JobStatus.SUSPENDED || Boolean(value.reason), "Add a reason when suspending a job."));
  const id = routeParam(request, "id");
  const existing = await prisma.job.findUnique({ where: { id }, include: { company: true } });
  if (!existing) throw notFound("Job not found.");
  if (input.status === JobStatus.PUBLISHED && (!existing.company.isApproved || existing.company.isSuspended)) {
    throw forbidden("Approve and reinstate the company before publishing its jobs.");
  }
  if (existing.status === input.status) throw conflict("That job already has this status.");
  const reason = input.reason || "Job status changed by an administrator.";
  const job = await prisma.$transaction(async (tx) => {
    const updated = await tx.job.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.status === JobStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
      },
    });
    const action = "JOB_STATUS_" + input.status;
    await tx.moderationAction.create({ data: { actorId: request.auth!.userId, targetType: "JOB", targetId: id, action, reason } });
    await tx.auditLog.create({ data: { actorId: request.auth!.userId, action, target: id, metadata: { status: input.status } } });
    return updated;
  });
  response.json({ job });
});

adminRouter.get("/reports", async (request, response) => {
  const parsedStatus = request.query.status === undefined ? undefined : z.nativeEnum(ReportStatus).safeParse(request.query.status);
  if (parsedStatus && !parsedStatus.success) throw badRequest("Choose a valid report status.");
  const reports = await prisma.report.findMany({
    ...(parsedStatus?.success ? { where: { status: parsedStatus.data } } : {}),
    include: {
      author: { select: { id: true, name: true } },
      job: { select: { id: true, title: true, status: true, company: { select: { id: true, name: true } } } },
      company: { select: { id: true, name: true, isApproved: true, isSuspended: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  response.json({ reports });
});
adminRouter.patch("/reports/:id", async (request, response) => {
  const input = requestBody(request, z.object({ status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]), note: z.string().trim().max(1000).optional() }));
  const id = routeParam(request, "id");
  const existing = await prisma.report.findUnique({ where: { id }, select: { id: true, status: true, jobId: true, companyId: true } });
  if (!existing) throw notFound("Report not found.");
  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.report.update({ where: { id }, data: { status: input.status } });
    const reason = input.note || "Report status changed by an administrator.";
    await tx.moderationAction.create({
      data: {
        actorId: request.auth!.userId, targetType: "REPORT", targetId: id,
        action: "REPORT_" + input.status, reason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: request.auth!.userId, action: "REPORT_" + input.status, target: id,
        metadata: { jobId: existing.jobId, companyId: existing.companyId, previousStatus: existing.status },
      },
    });
    return updated;
  });
  response.json({ report });
});

adminRouter.get("/users", async (_request, response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isSuspended: true, createdAt: true },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  response.json({ users });
});
adminRouter.patch("/users/:id/suspension", async (request, response) => {
  const input = requestBody(request, z.object({ suspended: z.boolean(), reason: z.string().trim().min(8).max(1000) }));
  const id = routeParam(request, "id");
  if (id === request.auth!.userId) throw forbidden("You cannot suspend your own administrator account.");
  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, isSuspended: true } });
  if (!existing) throw notFound("User not found.");
  if (existing.role === UserRole.ADMIN) throw forbidden("Administrator accounts cannot be suspended from this workspace.");
  if (existing.isSuspended === input.suspended) throw conflict(input.suspended ? "This user is already suspended." : "This user is already active.");
  const action = input.suspended ? "USER_SUSPENDED" : "USER_REINSTATED";
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { isSuspended: input.suspended } });
    if (input.suspended) await tx.session.deleteMany({ where: { userId: id } });
    await tx.moderationAction.create({
      data: { actorId: request.auth!.userId, targetType: "USER", targetId: id, action, reason: input.reason },
    });
    await tx.auditLog.create({ data: { actorId: request.auth!.userId, action, target: id, metadata: { reason: input.reason } } });
    return { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isSuspended: updated.isSuspended };
  });
  response.json({ user });
});

