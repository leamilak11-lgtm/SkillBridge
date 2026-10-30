import { ApplicationStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { notFound } from "../errors.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { requestBody, routeParam } from "../middleware/validate.js";
export const applicationsRouter = Router();
applicationsRouter.use(authenticate, allowRoles(UserRole.JOB_SEEKER));
applicationsRouter.get("/", async (request, response) => {
  const applications = await prisma.application.findMany({
    where: { userId: request.auth!.userId },
    select: {
      id: true, status: true, submittedAt: true, updatedAt: true, seekerNotes: true, coverLetter: true,
      resume: { select: { id: true, originalName: true } },
      job: {
        select: {
          id: true, title: true, location: true, workArrangement: true, employmentType: true, isDemo: true,
          company: { select: { name: true, isDemo: true } },
        },
      },
      history: { select: { status: true, note: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { submittedAt: "desc" },
  });
  response.json({ applications });
});
applicationsRouter.patch("/:id", async (request, response) => {
  const input = requestBody(request, z.object({ seekerNotes: z.string().trim().max(4000).nullable() }));
  const existing = await prisma.application.findFirst({ where: { id: routeParam(request, "id"), userId: request.auth!.userId }, select: { id: true } });
  if (!existing) throw notFound("Application not found.");
  const application = await prisma.application.update({
    where: { id: existing.id }, data: { seekerNotes: input.seekerNotes || null }, select: { id: true, seekerNotes: true },
  });
  response.json({ application });
});
applicationsRouter.post("/:id/withdraw", async (request, response) => {
  const existing = await prisma.application.findFirst({ where: { id: routeParam(request, "id"), userId: request.auth!.userId } });
  if (!existing) throw notFound("Application not found.");
  if (existing.status === ApplicationStatus.WITHDRAWN || existing.status === ApplicationStatus.REJECTED) {
    response.json({ status: existing.status });
    return;
  }
  const updated = await prisma.$transaction(async (tx) => {
    const application = await tx.application.update({
      where: { id: existing.id }, data: { status: ApplicationStatus.WITHDRAWN }, select: { id: true, status: true },
    });
    await tx.applicationStatusHistory.create({
      data: { applicationId: existing.id, status: ApplicationStatus.WITHDRAWN, changedById: request.auth!.userId },
    });
    return application;
  });
  response.json({ application: updated });
});
