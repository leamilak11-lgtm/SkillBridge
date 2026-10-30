import { GoalStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { notFound } from "../errors.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { requestBody, routeParam } from "../middleware/validate.js";
import { generatePlanSteps } from "../services/career-plan.js";
export const goalsRouter = Router();
goalsRouter.use(authenticate, allowRoles(UserRole.JOB_SEEKER));

goalsRouter.get("/", async (request, response) => {
  const goals = await prisma.careerGoal.findMany({
    where: { userId: request.auth!.userId },
    include: { plan: { include: { steps: { orderBy: { order: "asc" } } } } },
    orderBy: { updatedAt: "desc" },
  });
  response.json({ goals });
});

const createGoalSchema = z.object({
  targetRole: z.string().trim().min(2).max(180),
  targetDate: z.string().datetime().nullable().optional(),
  jobId: z.string().uuid().nullable().optional(),
});
goalsRouter.post("/", async (request, response) => {
  const input = requestBody(request, createGoalSchema);
  const [profile, job] = await Promise.all([
    prisma.seekerProfile.findUnique({ where: { userId: request.auth!.userId }, include: { skills: { include: { skill: true } }, experiences: true } }),
    input.jobId
      ? prisma.job.findFirst({ where: { id: input.jobId, status: "PUBLISHED" }, include: { skills: { include: { skill: true } } } })
      : prisma.job.findFirst({
          where: { status: "PUBLISHED", title: { contains: input.targetRole, mode: "insensitive" } },
          include: { skills: { include: { skill: true } }, company: true },
        }),
  ]);
  if (input.jobId && !job) throw notFound("The selected job is not available.");
  const steps = generatePlanSteps(input.targetRole, profile, job);
  const goal = await prisma.careerGoal.create({
    data: {
      userId: request.auth!.userId, targetRole: input.targetRole,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      plan: { create: { steps: { create: steps } } },
    },
    include: { plan: { include: { steps: { orderBy: { order: "asc" } } } } },
  });
  response.status(201).json({ goal });
});

goalsRouter.patch("/:id", async (request, response) => {
  const input = requestBody(request, z.object({
    targetRole: z.string().trim().min(2).max(180).optional(),
    targetDate: z.string().datetime().nullable().optional(),
    status: z.nativeEnum(GoalStatus).optional(),
  }));
  const existing = await prisma.careerGoal.findFirst({ where: { id: routeParam(request, "id"), userId: request.auth!.userId } });
  if (!existing) throw notFound("Career goal not found.");
  const goal = await prisma.careerGoal.update({
    where: { id: existing.id },
    data: {
      ...(input.targetRole !== undefined ? { targetRole: input.targetRole } : {}),
      ...(input.targetDate !== undefined ? { targetDate: input.targetDate ? new Date(input.targetDate) : null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: { plan: { include: { steps: { orderBy: { order: "asc" } } } } },
  });
  response.json({ goal });
});

goalsRouter.delete("/:id", async (request, response) => {
  const existing = await prisma.careerGoal.findFirst({ where: { id: routeParam(request, "id"), userId: request.auth!.userId } });
  if (!existing) throw notFound("Career goal not found.");
  await prisma.careerGoal.delete({ where: { id: existing.id } });
  response.status(204).end();
});

goalsRouter.post("/:id/steps", async (request, response) => {
  const input = requestBody(request, z.object({
    title: z.string().trim().min(2).max(180),
    reason: z.string().trim().min(2).max(1000),
    action: z.string().trim().min(2).max(2000),
    evidence: z.string().trim().min(2).max(1000),
    skillName: z.string().trim().max(100).nullable().optional(),
  }));
  const goal = await prisma.careerGoal.findFirst({
    where: { id: routeParam(request, "id"), userId: request.auth!.userId }, include: { plan: { include: { _count: { select: { steps: true } } } } },
  });
  if (!goal?.plan) throw notFound("Career plan not found.");
  const step = await prisma.planStep.create({
    data: {
      planId: goal.plan.id, ...input, skillName: input.skillName ?? null, custom: true, order: goal.plan._count.steps,
    },
  });
  response.status(201).json({ step });
});

goalsRouter.patch("/:goalId/steps/:stepId", async (request, response) => {
  const input = requestBody(request, z.object({
    title: z.string().trim().min(2).max(180).optional(),
    reason: z.string().trim().min(2).max(1000).optional(),
    action: z.string().trim().min(2).max(2000).optional(),
    evidence: z.string().trim().min(2).max(1000).optional(),
    completed: z.boolean().optional(),
    dismissed: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, "Make at least one change."));
  const step = await prisma.planStep.findFirst({
    where: { id: routeParam(request, "stepId"), plan: { goal: { id: routeParam(request, "goalId"), userId: request.auth!.userId } } },
  });
  if (!step) throw notFound("Plan step not found.");
  const updated = await prisma.planStep.update({
    where: { id: step.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.action !== undefined ? { action: input.action } : {}),
      ...(input.evidence !== undefined ? { evidence: input.evidence } : {}),
      ...(input.completed !== undefined ? { completedAt: input.completed ? new Date() : null } : {}),
      ...(input.dismissed !== undefined ? { dismissedAt: input.dismissed ? new Date() : null } : {}),
    },
  });
  response.json({ step: updated });
});
