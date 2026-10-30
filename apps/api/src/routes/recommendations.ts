import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { explainMatch } from "../services/matching.js";
import { localRecommendationSummary, requestOptionalAiSummary } from "../services/recommendations.js";

export const recommendationsRouter = Router();
recommendationsRouter.use(authenticate, allowRoles(UserRole.JOB_SEEKER));

recommendationsRouter.get("/", async (request, response) => {
  const query = z.object({ role: z.string().trim().min(2).max(180).optional(), ai: z.enum(["true", "false"]).default("false") }).parse(request.query);
  const [profile, jobs] = await Promise.all([
    prisma.seekerProfile.findUnique({
      where: { userId: request.auth!.userId }, include: { skills: { include: { skill: true } }, experiences: true },
    }),
    prisma.job.findMany({
      where: { status: "PUBLISHED", company: { isApproved: true, isSuspended: false } },
      include: {
        company: { select: { id: true, name: true, location: true, isDemo: true } },
        skills: { include: { skill: { select: { id: true, name: true, category: true } } } },
      },
      orderBy: { publishedAt: "desc" }, take: 100,
    }),
  ]);
  const role = query.role ?? profile?.desiredRoles[0] ?? "your next role";
  const matchingProfile = profile && query.role ? { ...profile, desiredRoles: [query.role] } : profile;
  const ranked = jobs.map((job) => ({
    job,
    match: matchingProfile ? explainMatch(matchingProfile, job) : null,
  })).sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1)).slice(0, 6);
  const opportunities = ranked.map(({ job, match }) => ({
    id: job.id,
    title: job.title.replace(/^Demo role: /, ""),
    company: job.company.name.replace(/^Demo [—-] /, ""),
    location: job.location,
    isDemo: job.isDemo,
    skills: job.skills.map((item) => item.skill.name),
    match,
  }));
  const recommendationInputs = ranked.map(({ job, match }) => ({
    title: job.title.replace(/^Demo role: /, ""),
    skills: job.skills.map((item) => item.skill.name),
    missingRequiredSkills: match?.missingRequiredSkills ?? [],
  }));
  const skills = profile?.skills.map((item) => item.skill.name) ?? [];
  const experienceTitles = profile?.experiences.map((item) => item.title).filter(Boolean) ?? [];
  const localSummary = localRecommendationSummary(role, skills, recommendationInputs, experienceTitles);
  const aiSummary = query.ai === "true" && config.openAiApiKey ? await requestOptionalAiSummary({
    apiKey: config.openAiApiKey, model: config.openAiModel,
    targetRole: role,
    skills: Array.from(new Set(skills)).slice(0, 30),
    experience: profile?.experiences.slice(0, 5).map(({ title, description }) => ({ title, description: description.slice(0, 320) })) ?? [],
    preferences: {
      industries: profile?.desiredIndustries.slice(0, 10) ?? [],
      workArrangements: profile?.workArrangements ?? [],
      employmentTypes: profile?.employmentTypes ?? [],
    },
    opportunities: recommendationInputs,
  }) : null;
  response.json({
    role, opportunities, summary: aiSummary ?? localSummary,
    source: aiSummary ? "OPTIONAL_AI" : "LOCAL_RULES",
    aiAvailable: Boolean(config.openAiApiKey),
  });
});
