import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { conflict, forbidden, notFound } from "../errors.js";
import { authenticate } from "../middleware/auth.js";
import { requestBody } from "../middleware/validate.js";

export const reportsRouter = Router();
reportsRouter.use(authenticate);
const reportInput = z.object({
  jobId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  reason: z.string().trim().min(10).max(1000),
}).refine((value) => Boolean(value.jobId) !== Boolean(value.companyId), "Report one job or one company.");
reportsRouter.post("/", async (request, response) => {
  const input = requestBody(request, reportInput);
  if (input.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, status: "PUBLISHED", company: { isApproved: true, isSuspended: false } },
      select: { id: true, companyId: true },
    });
    if (!job) throw notFound("Job not found.");
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: job.companyId, userId: request.auth!.userId } },
      select: { id: true },
    });
    if (membership) throw forbidden("You cannot report a job posted by your own company.");
  } else if (input.companyId) {
    const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true } });
    if (!company) throw notFound("Company not found.");
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: input.companyId, userId: request.auth!.userId } },
      select: { id: true },
    });
    if (membership) throw forbidden("You cannot report your own company.");
  }
  const duplicate = await prisma.report.findFirst({
    where: {
      authorId: request.auth!.userId,
      ...(input.jobId ? { jobId: input.jobId } : input.companyId ? { companyId: input.companyId } : {}),
      status: { in: ["OPEN", "REVIEWING"] },
    },
    select: { id: true },
  });
  if (duplicate) throw conflict("You already have an open report for this listing.");
  const report = await prisma.report.create({
    data: { authorId: request.auth!.userId, jobId: input.jobId ?? null, companyId: input.companyId ?? null, reason: input.reason },
    select: { id: true, status: true, createdAt: true },
  });
  response.status(201).json({ report });
});
