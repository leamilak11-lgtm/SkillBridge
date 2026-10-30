import { Router } from "express";
import { SkillSource, SuggestionStatus, UserRole, type Prisma } from "@prisma/client";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { requestBody, routeParam } from "../middleware/validate.js";
import { normalizeSkill } from "../services/matching.js";
import { requestAiResumeSuggestions } from "../services/ai-resume-parser.js";
import { analyzeResume, validResumeSignature } from "../services/resume-analysis.js";
import { reviewResume } from "../services/resume-feedback.js";
import { newStorageKey, privateStorage } from "../services/private-storage.js";
export const resumesRouter = Router();
const accepted = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_RESUME_BYTES ?? 5 * 1024 * 1024), files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    callback(null, accepted.get(extension) === file.mimetype);
  },
});
const safeResume = (resume: {
  id: string; originalName: string; mimeType: string; sizeBytes: number; analysisStatus: string; createdAt: Date; extractedText?: string | null;
  suggestions?: Array<{ id: string; kind: string; value: string; evidence: string; status: string }>;
}) => ({
  id: resume.id, originalName: resume.originalName, mimeType: resume.mimeType, sizeBytes: resume.sizeBytes,
  analysisStatus: resume.analysisStatus, createdAt: resume.createdAt, suggestions: resume.suggestions ?? [],
  aiAssisted: resume.suggestions?.some((suggestion) => suggestion.kind.startsWith("ai_")) ?? false,
  feedback: resume.analysisStatus === "READY" ? reviewResume(resume.extractedText ?? "") : null,
});
resumesRouter.use(authenticate, allowRoles(UserRole.JOB_SEEKER));
resumesRouter.get("/", async (request, response) => {
  const resumes = await prisma.resume.findMany({
    where: { userId: request.auth!.userId }, include: { suggestions: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  response.json({ resumes: resumes.map(safeResume), aiAvailable: Boolean(config.openAiApiKey) });
});
function useAiFromMultipart(value: unknown) {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw badRequest("AI parsing choice is invalid.");
}
async function receiveResume(userId: string, file: Express.Multer.File, useAi: boolean, replaceId?: string) {
  const openAiApiKey = config.openAiApiKey;
  if (useAi && !openAiApiKey) throw badRequest("AI resume parsing is not configured. You can still upload and review your resume locally.");
  const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf(".")) as ".pdf" | ".docx";
  if (accepted.get(extension) !== file.mimetype || !validResumeSignature(file.buffer, file.mimetype)) {
    throw badRequest("Choose a valid PDF or DOCX resume.");
  }
  const existing = replaceId ? await prisma.resume.findFirst({ where: { id: replaceId, userId } }) : null;
  if (replaceId && !existing) throw notFound("Resume not found.");
  const storageKey = newStorageKey(extension.slice(1) as "pdf" | "docx");
  await privateStorage.put(storageKey, file.mimetype, file.buffer);
  let analysis: { text: string; suggestions: Array<{ kind: string; value: string; evidence: string }> } | null = null;
  try { analysis = await analyzeResume(file.buffer, file.mimetype); } catch { /* Manual profile entry remains available. */ }
  const aiSuggestions = useAi && analysis && openAiApiKey ? await requestAiResumeSuggestions({
    apiKey: openAiApiKey, model: config.openAiModel, resumeText: analysis.text,
  }) : null;
  const allSuggestions = analysis ? [...analysis.suggestions, ...(aiSuggestions ?? [])] : [];
  const seenSuggestions = new Set<string>();
  const suggestions = allSuggestions.filter((suggestion) => {
    const baseKind = suggestion.kind.replace(/^ai_/, "");
    const normalized = baseKind + ":" + suggestion.value.toLocaleLowerCase().trim();
    if (seenSuggestions.has(normalized)) return false;
    seenSuggestions.add(normalized);
    return true;
  });
  const originalName = file.originalname.replace(/[\\/\r\n"]/g, "_").slice(0, 255);
  let resume: Prisma.ResumeGetPayload<{ include: { suggestions: true } }>;
  try {
    resume = existing
      ? await prisma.$transaction(async (tx) => {
          await tx.resumeSuggestion.deleteMany({ where: { resumeId: existing.id } });
          return tx.resume.update({
            where: { id: existing.id },
            data: {
              originalName, storageKey, mimeType: file.mimetype, sizeBytes: file.size,
              extractedText: analysis?.text ?? null, analysisStatus: analysis ? "READY" : "FAILED",
              ...(suggestions.length ? { suggestions: { create: suggestions } } : {}),
            },
            include: { suggestions: true },
          });
        })
      : await prisma.resume.create({
          data: {
            userId, originalName, storageKey, mimeType: file.mimetype, sizeBytes: file.size,
            extractedText: analysis?.text ?? null, analysisStatus: analysis ? "READY" : "FAILED",
            ...(suggestions.length ? { suggestions: { create: suggestions } } : {}),
          },
          include: { suggestions: true },
        });
  } catch (error) {
    await privateStorage.remove(storageKey).catch(() => undefined);
    throw error;
  }
  if (existing) {
    try {
      await privateStorage.remove(existing.storageKey);
    } catch {
      // Keep the new resume usable if cleanup of the previous private object needs retrying.
    }
  }
  return safeResume(resume);
}
resumesRouter.post("/", upload.single("resume"), async (request, response) => {
  if (!request.file) throw badRequest("Choose a PDF or DOCX resume to upload.");
  response.status(201).json({ resume: await receiveResume(request.auth!.userId, request.file, useAiFromMultipart(request.body?.useAi)) });
});
resumesRouter.post("/:id/replace", upload.single("resume"), async (request, response) => {
  if (!request.file) throw badRequest("Choose a PDF or DOCX resume to upload.");
  response.json({ resume: await receiveResume(request.auth!.userId, request.file, useAiFromMultipart(request.body?.useAi), routeParam(request, "id")) });
});
resumesRouter.get("/:id/download", async (request, response) => {
  const resume = await prisma.resume.findFirst({ where: { id: routeParam(request, "id"), userId: request.auth!.userId } });
  if (!resume) throw notFound("Resume not found.");
  const bytes = await privateStorage.get(resume.storageKey);
  response.setHeader("Content-Type", resume.mimeType);
  response.setHeader("Content-Length", bytes.length);
  response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent(resume.originalName));
  response.setHeader("Cache-Control", "private, no-store");
  response.send(bytes);
});
resumesRouter.delete("/:id", async (request, response) => {
  const resume = await prisma.resume.findFirst({ where: { id: routeParam(request, "id"), userId: request.auth!.userId } });
  if (!resume) throw notFound("Resume not found.");
  await privateStorage.remove(resume.storageKey);
  await prisma.resume.delete({ where: { id: resume.id } });
  response.status(204).end();
});
resumesRouter.patch("/:id/suggestions/:suggestionId", async (request, response) => {
  const input = requestBody(request, z.object({
    decision: z.enum(["confirm", "reject"]),
    value: z.string().trim().min(1).max(1000).optional(),
  }));
  const resume = await prisma.resume.findFirst({ where: { id: routeParam(request, "id"), userId: request.auth!.userId } });
  if (!resume) throw notFound("Resume not found.");
  const suggestion = await prisma.resumeSuggestion.findFirst({
    where: { id: routeParam(request, "suggestionId"), resumeId: resume.id, status: SuggestionStatus.PENDING },
  });
  if (!suggestion) throw notFound("Suggestion not found or already reviewed.");
  const proposedValue = input.value ?? suggestion.value;
  const reviewData = {
    status: input.decision === "confirm" ? SuggestionStatus.CONFIRMED : SuggestionStatus.REJECTED,
    ...(input.decision === "confirm" ? { value: proposedValue } : {}),
    reviewedAt: new Date(),
  };
  let updated;
  const kind = suggestion.kind.replace(/^ai_/, "");
  if (input.decision === "confirm") {
    const profile = await prisma.seekerProfile.findUnique({ where: { userId: request.auth!.userId } });
    if (!profile) throw forbidden("A seeker profile is required to confirm resume suggestions.");
    const parts = proposedValue.split("|").map((part) => part.trim());
    const dateFromMonth = (value: string | undefined) => value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
      ? new Date(`${value}-01T00:00:00.000Z`)
      : null;
    const safeUrl = (value: string | undefined) => {
      if (!value) return null;
      try { const parsed = new URL(value); return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null; }
      catch { return null; }
    };
    if (kind === "skill") {
    if (proposedValue.length > 100) throw badRequest("A skill name must be 100 characters or fewer.");
    const normalized = normalizeSkill(proposedValue);
    const skill = await prisma.skill.upsert({
      where: { normalized }, update: {}, create: { name: proposedValue, normalized, category: "General" },
    });
    updated = await prisma.$transaction(async (tx) => {
      await tx.userSkill.upsert({
        where: { profileId_skillId: { profileId: profile.id, skillId: skill.id } },
        update: { source: SkillSource.USER_CONFIRMED, evidence: suggestion.evidence },
        create: { profileId: profile.id, skillId: skill.id, source: SkillSource.USER_CONFIRMED, evidence: suggestion.evidence },
      });
      return tx.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
    });
    } else if (kind === "experience") {
      const [title, company, description, start, end] = parts;
      if (!title || !company || !description) throw badRequest("Add a role, company, and description before confirming this experience.");
      if (title.length > 180 || company.length > 180 || description.length > 4000) throw badRequest("Keep the role and company under 180 characters and the description under 4,000 characters.");
      if ((start && !dateFromMonth(start)) || (end && end.toLowerCase() !== "current" && !dateFromMonth(end))) throw badRequest("Use dates in YYYY-MM format, or leave them blank.");
      const isCurrent = (end ?? "").toLowerCase() === "current";
      updated = await prisma.$transaction(async (tx) => {
        await tx.experience.create({ data: { profileId: profile.id, title, company, description, startDate: dateFromMonth(start), endDate: isCurrent ? null : dateFromMonth(end), isCurrent, source: SkillSource.USER_CONFIRMED } });
        return tx.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
      });
    } else if (kind === "education") {
      const [qualification, institution, field] = parts;
      if (!institution) throw badRequest("Add an institution before confirming this education entry.");
      if ([qualification, institution, field].some((part) => (part?.length ?? 0) > 180)) throw badRequest("Education fields must be 180 characters or fewer.");
      updated = await prisma.$transaction(async (tx) => {
        await tx.education.create({ data: { profileId: profile.id, qualification: qualification || null, institution, field: field || null, source: SkillSource.USER_CONFIRMED } });
        return tx.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
      });
    } else if (kind === "project") {
      const [name, description, url] = parts;
      if (!name || !description) throw badRequest("Add a project name and description before confirming this project.");
      if (name.length > 180 || description.length > 3000 || (url?.length ?? 0) > 500) throw badRequest("Project fields exceed their supported length.");
      updated = await prisma.$transaction(async (tx) => {
        await tx.project.create({ data: { profileId: profile.id, name, description, url: safeUrl(url), source: SkillSource.USER_CONFIRMED } });
        return tx.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
      });
    } else if (kind === "certification") {
      const [name, issuer, url] = parts;
      if (!name || !issuer) throw badRequest("Add a certification name and issuer before confirming this entry.");
      if (name.length > 180 || issuer.length > 180 || (url?.length ?? 0) > 500) throw badRequest("Certification fields exceed their supported length.");
      updated = await prisma.$transaction(async (tx) => {
        await tx.certification.create({ data: { profileId: profile.id, name, issuer, credentialUrl: safeUrl(url), source: SkillSource.USER_CONFIRMED } });
        return tx.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
      });
    } else if (kind === "language") {
      const [name, proficiency] = parts;
      if (!name) throw badRequest("Add a language before confirming this entry.");
      if (name.length > 80 || (proficiency?.length ?? 0) > 40) throw badRequest("Language fields exceed their supported length.");
      updated = await prisma.$transaction(async (tx) => {
        await tx.language.upsert({ where: { profileId_name: { profileId: profile.id, name } }, update: { proficiency: proficiency || null }, create: { profileId: profile.id, name, proficiency: proficiency || null } });
        return tx.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
      });
    } else if (kind === "targetRole") {
      if (proposedValue.length > 180) throw badRequest("A target role must be 180 characters or fewer.");
      const desiredRoles = profile.desiredRoles.some((role) => role.toLowerCase() === proposedValue.toLowerCase())
        ? profile.desiredRoles
        : [...profile.desiredRoles, proposedValue].slice(0, 20);
      updated = await prisma.$transaction(async (tx) => {
        await tx.seekerProfile.update({ where: { id: profile.id }, data: { desiredRoles } });
        return tx.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
      });
    } else if (kind === "headline") {
      if (proposedValue.length > 180) throw badRequest("A headline must be 180 characters or fewer.");
      updated = await prisma.$transaction(async (tx) => {
        await tx.seekerProfile.update({ where: { id: profile.id }, data: { headline: proposedValue.slice(0, 180) } });
        return tx.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
      });
    } else {
      throw badRequest("This resume suggestion type cannot be added to your profile.");
    }
  } else {
    updated = await prisma.resumeSuggestion.update({ where: { id: suggestion.id }, data: reviewData });
  }
  response.json({ suggestion: updated });
});
