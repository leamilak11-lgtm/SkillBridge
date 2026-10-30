import "dotenv/config";
import { randomUUID } from "node:crypto";
import { EmploymentType, JobStatus, PrismaClient, WorkArrangement } from "@prisma/client";
import { hashPassword } from "../src/security/password.js";
const prisma = new PrismaClient();

async function main() {
  const demoEmail = "demo-recruiter@skillbridge.local";
  let demoUser = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        name: "SkillBridge Demo Recruiter", email: demoEmail,
        passwordHash: await hashPassword(randomUUID()),
        role: "RECRUITER", emailVerifiedAt: new Date(),
      },
    });
  }
  const data = [
    {
      company: "Greenpath Studio", title: "Demo role: Frontend Developer", location: "Addis Ababa, Ethiopia",
      workArrangement: WorkArrangement.HYBRID, employmentType: EmploymentType.FULL_TIME, industry: "Technology",
      description: "A clearly labelled sample opportunity for exploring SkillBridge's profile and match features.",
      responsibilities: ["Build accessible web interfaces", "Collaborate on product improvements"], experienceMinYears: 1,
      skills: [{ name: "TypeScript", category: "Technology", required: true }, { name: "React", category: "Technology", required: true }, { name: "Accessibility", category: "Design", required: false }],
    },
    {
      company: "Open Field Analytics", title: "Demo role: Data Analyst", location: "Remote — East Africa",
      workArrangement: WorkArrangement.REMOTE, employmentType: EmploymentType.FULL_TIME, industry: "Analytics",
      description: "Sample listing only. This is demo content and is not a live vacancy.",
      responsibilities: ["Prepare clear reporting", "Explore datasets with SQL"], experienceMinYears: 1,
      skills: [{ name: "SQL", category: "Data", required: true }, { name: "Python", category: "Data", required: true }, { name: "Data visualization", category: "Data", required: false }],
    },
    {
      company: "Cedar Works", title: "Demo role: Product Designer", location: "Addis Ababa, Ethiopia",
      workArrangement: WorkArrangement.ONSITE, employmentType: EmploymentType.CONTRACT, industry: "Design",
      description: "Sample listing only. No real employer or opening is represented by this demo record.",
      responsibilities: ["Create and test prototypes", "Document interface decisions"], experienceMinYears: 2,
      skills: [{ name: "Figma", category: "Design", required: true }, { name: "Prototyping", category: "Design", required: true }, { name: "Accessibility", category: "Design", required: false }],
    },
  ];
  for (const item of data) {
    const companyName = "Demo — " + item.company;
    const company = await prisma.company.upsert({
      where: { name: companyName },
      update: { isDemo: true, isApproved: true, isSuspended: false, location: item.location },
      create: {
        name: companyName, isDemo: true, isApproved: true, location: item.location,
        members: { create: { userId: demoUser.id, isOwner: true } },
      },
    });
    const existing = await prisma.job.findFirst({ where: { companyId: company.id, title: item.title } });
    if (existing) {
      await prisma.job.update({ where: { id: existing.id }, data: { location: item.location } });
      continue;
    }
    const skillConnections = await Promise.all(item.skills.map(async (skill) => {
      const normalized = skill.name.toLowerCase();
      const record = await prisma.skill.upsert({
        where: { normalized }, update: {}, create: { name: skill.name, normalized, category: skill.category },
      });
      return { skillId: record.id, required: skill.required };
    }));
    await prisma.job.create({
      data: {
        companyId: company.id, createdById: demoUser.id, title: item.title, location: item.location,
        workArrangement: item.workArrangement, employmentType: item.employmentType, industry: item.industry,
        description: item.description, responsibilities: item.responsibilities, experienceMinYears: item.experienceMinYears,
        status: JobStatus.PUBLISHED, isDemo: true, publishedAt: new Date(), skills: { create: skillConnections },
      },
    });
  }
  console.info("Seeded " + data.length + " labelled demo jobs.");
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
