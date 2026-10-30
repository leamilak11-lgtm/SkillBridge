import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { notFound } from "../errors.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { generateInterviewQuestions } from "../services/interview-prep.js";

export const interviewPrepRouter = Router();
interviewPrepRouter.use(authenticate, allowRoles(UserRole.JOB_SEEKER));

interviewPrepRouter.get("/", async (request, response) => {
  const query = z.object({
    role: z.string().trim().min(2).max(180).optional(),
    jobId: z.string().uuid().optional(),
  }).parse(request.query);
  const [profile, job] = await Promise.all([
    prisma.seekerProfile.findUnique({ where: { userId: request.auth!.userId }, include: { skills: { include: { skill: true } } } }),
    query.jobId ? prisma.job.findFirst({
      where: { id: query.jobId, status: "PUBLISHED", company: { isApproved: true, isSuspended: false } },
      include: { skills: { include: { skill: true } } },
    }) : null,
  ]);
  if (query.jobId && !job) throw notFound("The selected job is not available.");
  const role = (job?.title ?? query.role ?? profile?.desiredRoles[0] ?? "your target role").replace(/^Demo role: /, "");
  const skills = Array.from(new Set([
    ...(profile?.skills.map((item) => item.skill.name) ?? []),
    ...(job?.skills.map((item) => item.skill.name) ?? []),
  ]));
  response.json({ role, source: "LOCAL_GUIDANCE", questions: generateInterviewQuestions(role, skills) });
});
