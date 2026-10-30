import type { SeekerProfile } from "@prisma/client";
import { prisma } from "../db.js";

export function profileCompletion(profile: (SeekerProfile & { skills: unknown[]; experiences: unknown[]; education: unknown[]; projects: unknown[] }) | null) {
  const sections = [
    { key: "basics", label: "Profile basics", complete: Boolean(profile?.headline && profile?.location && profile?.biography) },
    { key: "skills", label: "Skills", complete: Boolean(profile?.skills.length) },
    { key: "experience", label: "Experience", complete: Boolean(profile?.experiences.length) },
    { key: "education-projects", label: "Education or projects", complete: Boolean(profile?.education.length || profile?.projects.length) },
    { key: "target", label: "Target role", complete: Boolean(profile?.desiredRoles.length) },
  ];
  const completeCount = sections.filter((section) => section.complete).length;
  return { percent: Math.round((completeCount / sections.length) * 100), sections };
}

export async function getProfile(userId: string) {
  const profile = await prisma.seekerProfile.findUnique({
    where: { userId },
    include: {
      skills: { include: { skill: true }, orderBy: { skill: { name: "asc" } } },
      experiences: { orderBy: { startDate: "desc" } },
      education: { orderBy: { endDate: "desc" } },
      projects: { orderBy: { endDate: "desc" } },
      certifications: { orderBy: { issuedAt: "desc" } },
      languages: { orderBy: { name: "asc" } },
    },
  });
  if (!profile) return { profile, completion: profileCompletion(profile) };
  const { avatarStorageKey, avatarMimeType: _avatarMimeType, ...safeProfile } = profile;
  return {
    profile: { ...safeProfile, avatarUrl: avatarStorageKey ? "/api/profile/avatar" : null },
    completion: profileCompletion(profile),
  };
}
