import type { CareerGoal, Job, SeekerProfile, UserSkill, Skill, Experience, JobSkill } from "@prisma/client";
import { explainMatch } from "./matching.js";

type ProfileForPlan = SeekerProfile & {
  skills: (UserSkill & { skill: Skill })[];
  experiences: Experience[];
};
type JobForPlan = Job & { skills: (JobSkill & { skill: Skill })[] };
type SuggestedStep = { title: string; reason: string; action: string; evidence: string; skillName?: string; order: number; custom: false };

export function generatePlanSteps(targetRole: string, profile: ProfileForPlan | null, job: JobForPlan | null): SuggestedStep[] {
  const steps: SuggestedStep[] = [];
  if (job && profile) {
    const match = explainMatch(profile, job);
    const gaps = [...match.missingRequiredSkills, ...match.missingPreferredSkills, ...match.notYetEvidencedSkills];
    const uniqueGaps = [...new Set(gaps)];
    for (const skill of uniqueGaps.slice(0, 5)) {
      const required = match.missingRequiredSkills.includes(skill);
      steps.push({
        title: "Build evidence for " + skill,
        reason: (required ? "The selected role lists " : "The selected role prefers ") + skill + ", and your profile does not yet show evidence for it.",
        action: "Choose a small task that uses " + skill + " in a project or course exercise. Write down the problem, your approach, and what you learned.",
        evidence: "Add a project or experience entry with a link, a short description, and the specific work you completed.",
        skillName: skill, order: steps.length, custom: false,
      });
    }
  }
  if (steps.length < 3) {
    const evidenceTopic = job?.skills[0]?.skill.name ?? targetRole;
    steps.push({
      title: "Make one example of your work easy to review",
      reason: "A reviewer can understand your experience more clearly when your profile points to a concrete example.",
      action: "Choose a project related to " + evidenceTopic + ". Add a short summary of the goal, your contribution, and the result without adding information you cannot verify.",
      evidence: "Add the project to your SkillBridge profile with a working link or a clear description.",
      order: steps.length, custom: false,
    });
  }
  if (steps.length < 3) {
    steps.push({
      title: "Review your target role requirements",
      reason: "Requirements differ between employers, so comparing more than one listing can reveal which skills appear repeatedly.",
      action: "Save two relevant listings and note the requirements that show up in both.",
      evidence: "Add the repeated requirements to your target-role notes or profile preferences.",
      order: steps.length, custom: false,
    });
  }
  if (steps.length < 3) {
    steps.push({
      title: "Update your profile with confirmed evidence",
      reason: "Your match explanations use the profile information you have reviewed and confirmed.",
      action: "Add a skill, experience, education entry, or project that is accurate and relevant to " + targetRole + ".",
      evidence: "Confirm the saved entry appears in your profile and in the job's match explanation.",
      order: steps.length, custom: false,
    });
  }
  return steps.slice(0, 6);
}
