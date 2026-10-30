import { UserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { explainMatch } from "../services/matching.js";
export const savedJobsRouter = Router();
savedJobsRouter.use(authenticate, allowRoles(UserRole.JOB_SEEKER));
savedJobsRouter.get("/", async (request, response) => {
  const [savedJobs, profile] = await Promise.all([
    prisma.savedJob.findMany({
      where: { userId: request.auth!.userId },
      include: { job: { include: {
        company: { select: { id: true, name: true, location: true, isDemo: true } },
        skills: { include: { skill: { select: { name: true, category: true } } } },
      } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.seekerProfile.findUnique({
      where: { userId: request.auth!.userId }, include: { skills: { include: { skill: true } }, experiences: true },
    }),
  ]);
  response.json({
    savedJobs: savedJobs.map(({ id, createdAt, job }) => ({
      id, createdAt, job: {
        id: job.id, title: job.title, location: job.location, workArrangement: job.workArrangement,
        employmentType: job.employmentType, industry: job.industry, description: job.description,
        responsibilities: job.responsibilities, experienceMinYears: job.experienceMinYears,
        experienceMaxYears: job.experienceMaxYears, salaryMin: job.salaryMin, salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency, applicationDeadline: job.applicationDeadline, isDemo: job.isDemo,
        publishedAt: job.publishedAt, company: job.company,
        skills: job.skills.map((item) => ({ name: item.skill.name, category: item.skill.category, required: item.required })),
        match: profile ? explainMatch(profile, job) : null,
      },
    })),
  });
});
