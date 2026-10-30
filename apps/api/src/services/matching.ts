export const MATCH_WEIGHTS = {
  skills: 0.4,
  experience: 0.2,
  role: 0.1,
  location: 0.1,
  salary: 0.1,
  employment: 0.05,
  industry: 0.05,
} as const;

const aliases: Record<string, string> = {
  js: "javascript", "javascript (es6+)": "javascript", ts: "typescript", "react.js": "react",
  reactjs: "react", "node.js": "node", nodejs: "node", postgres: "postgresql",
  "amazon web services": "aws",
};
export function normalizeSkill(value: string): string {
  const normalized = value.toLowerCase().trim().replace(/\s+/g, " ");
  return aliases[normalized] ?? normalized;
}
export type MatchProfile = {
  headline?: string | null; location?: string | null; desiredRoles?: string[];
  desiredIndustries?: string[]; preferredLocations?: string[]; workArrangements?: string[];
  employmentTypes?: string[]; salaryMin?: number | null; salaryMax?: number | null;
  salaryCurrency?: string | null;
  skills: Array<{ skill: { name: string }; evidence?: string | null; yearsExperience?: number | null }>;
  experiences: Array<{ title: string; startDate?: Date | null; endDate?: Date | null; isCurrent?: boolean }>;
};
export type MatchJob = {
  title: string; location?: string | null; workArrangement: string; employmentType: string;
  industry?: string | null; experienceMinYears?: number | null; salaryMin?: number | null;
  salaryMax?: number | null; salaryCurrency?: string | null;
  skills: Array<{ required: boolean; skill: { name: string } }>;
};
type Dimension = { key: string; label: string; weight: number; available: boolean; score: number | null; explanation: string };
type SkillEvidence = { name: string; evidence: string | null };
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function matchSkills(profile: MatchProfile, job: MatchJob) {
  const profileSkills = new Map<string, SkillEvidence>();
  for (const item of profile.skills) {
    const key = normalizeSkill(item.skill.name);
    if (!profileSkills.has(key)) profileSkills.set(key, { name: item.skill.name, evidence: item.evidence ?? null });
  }
  const required = job.skills.filter((item) => item.required);
  const preferred = job.skills.filter((item) => !item.required);
  const matching: SkillEvidence[] = [];
  const missingRequired: string[] = [];
  const missingPreferred: string[] = [];
  let weightedMatched = 0;
  const total = required.length * 2 + preferred.length;
  for (const item of required) {
    const evidence = profileSkills.get(normalizeSkill(item.skill.name));
    if (evidence) { matching.push(evidence); weightedMatched += 2; }
    else missingRequired.push(item.skill.name);
  }
  for (const item of preferred) {
    const evidence = profileSkills.get(normalizeSkill(item.skill.name));
    if (evidence) { matching.push(evidence); weightedMatched += 1; }
    else missingPreferred.push(item.skill.name);
  }
  const available = total > 0 && profileSkills.size > 0;
  return {
    available,
    score: available ? Math.round((weightedMatched / total) * 100) : null,
    matching,
    missingRequired,
    missingPreferred,
    notYetEvidenced: !profileSkills.size && job.skills.length ? job.skills.map((item) => item.skill.name) : [],
    explanation: !job.skills.length
      ? "The listing does not specify skills."
      : !profileSkills.size
        ? "Add profile skills to compare this requirement."
        : matching.length + " of " + job.skills.length + " listed skills have profile evidence.",
  };
}
function experienceYears(profile: MatchProfile): number | null {
  if (profile.experiences.length) {
    const now = Date.now();
    const intervals = profile.experiences.flatMap((item) => {
      if (!item.startDate) return [];
      const end = item.isCurrent || !item.endDate ? now : item.endDate.getTime();
      return end > item.startDate.getTime() ? [{ start: item.startDate.getTime(), end }] : [];
    });
    if (intervals.length) {
      intervals.sort((a, b) => a.start - b.start);
      let start = intervals[0]!.start;
      let end = intervals[0]!.end;
      let days = 0;
      for (const interval of intervals.slice(1)) {
        if (interval.start <= end) end = Math.max(end, interval.end);
        else {
          days += end - start;
          start = interval.start;
          end = interval.end;
        }
      }
      days += end - start;
      return days / (1000 * 60 * 60 * 24 * 365.25);
    }
  }
  const stated = profile.skills.map((skill) => skill.yearsExperience)
    .filter((value): value is number => value !== null && value !== undefined);
  return stated.length ? Math.max(...stated) : null;
}
function tokenOverlap(a: string, b: string): number {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").split(/\s+/).filter((word) => word.length > 2);
  const first = new Set(normalize(a)), second = new Set(normalize(b));
  if (!first.size || !second.size) return 0;
  let shared = 0;
  for (const token of first) if (second.has(token)) shared += 1;
  return shared / Math.max(first.size, second.size);
}
function salaryScore(profile: MatchProfile, job: MatchJob): Dimension {
  const hasProfileRange = profile.salaryMin != null || profile.salaryMax != null;
  const hasJobRange = job.salaryMin != null || job.salaryMax != null;
  if (!hasProfileRange || !hasJobRange) {
    return { key: "salary", label: "Salary", weight: MATCH_WEIGHTS.salary, available: false, score: null, explanation: "Salary preferences or range were not provided." };
  }
  if (!profile.salaryCurrency || !job.salaryCurrency) {
    return { key: "salary", label: "Salary", weight: MATCH_WEIGHTS.salary, available: false, score: null, explanation: "A salary currency is missing, so the ranges are not compared." };
  }
  if (!sameText(profile.salaryCurrency, job.salaryCurrency)) {
    return { key: "salary", label: "Salary", weight: MATCH_WEIGHTS.salary, available: false, score: null, explanation: "The salary currencies differ, so they are not compared." };
  }
  const lower = profile.salaryMin ?? 0, upper = profile.salaryMax ?? Number.POSITIVE_INFINITY;
  const jobLower = job.salaryMin ?? 0, jobUpper = job.salaryMax ?? Number.POSITIVE_INFINITY;
  const overlaps = lower <= jobUpper && jobLower <= upper;
  return {
    key: "salary", label: "Salary", weight: MATCH_WEIGHTS.salary, available: true, score: overlaps ? 100 : 0,
    explanation: overlaps ? "The stated salary ranges overlap." : "The stated salary ranges do not overlap.",
  };
}

export function explainMatch(profile: MatchProfile, job: MatchJob) {
  const skillResult = matchSkills(profile, job);
  const years = experienceYears(profile);
  const experienceAvailable = years !== null && job.experienceMinYears != null;
  const roleSignals = [...(profile.desiredRoles ?? []), ...(profile.headline ? [profile.headline] : []), ...profile.experiences.map((item) => item.title)];
  const roleScore = roleSignals.length ? Math.round(Math.max(...roleSignals.map((signal) => tokenOverlap(signal, job.title))) * 100) : null;
  const locations = [...(profile.preferredLocations ?? []), ...(profile.location ? [profile.location] : [])];
  const arrangements = profile.workArrangements ?? [];
  let locationScore: number | null = null;
  let locationExplanation = "Add a location or work arrangement preference to compare this dimension.";
  if (locations.length || arrangements.length) {
    const arrangementMatch = arrangements.some((value) => value === job.workArrangement);
    const locationMatch = locations.some((value) => sameText(value, job.location ?? ""));
    const remote = job.workArrangement === "REMOTE";
    locationScore = arrangementMatch || locationMatch ? 100 : remote ? 65 : 35;
    locationExplanation = arrangementMatch
      ? "The work arrangement matches a stated preference."
      : locationMatch
        ? "The job location matches your profile."
        : remote
          ? "The listing is remote; no stated location preference matches."
          : "The job location differs from your profile preferences.";
  }
  const salary = salaryScore(profile, job);
  const employmentAvailable = (profile.employmentTypes?.length ?? 0) > 0;
  const employmentScore = employmentAvailable ? (profile.employmentTypes ?? []).includes(job.employmentType) ? 100 : 0 : null;
  const industryAvailable = Boolean(job.industry && profile.desiredIndustries?.length);
  const industryScore = industryAvailable ? profile.desiredIndustries!.some((value) => sameText(value, job.industry!)) ? 100 : 0 : null;
  const dimensions: Dimension[] = [
    { key: "skills", label: "Skills", weight: MATCH_WEIGHTS.skills, available: skillResult.available, score: skillResult.score, explanation: skillResult.explanation },
    {
      key: "experience", label: "Experience", weight: MATCH_WEIGHTS.experience, available: experienceAvailable,
      score: experienceAvailable ? Math.round(Math.min(1, years! / Math.max(job.experienceMinYears!, 0.5)) * 100) : null,
      explanation: experienceAvailable ? "Your profile shows about " + years!.toFixed(1) + " years; this role lists " + job.experienceMinYears + " years minimum." : "Experience details or a role expectation are missing.",
    },
    { key: "role", label: "Role alignment", weight: MATCH_WEIGHTS.role, available: roleScore !== null, score: roleScore, explanation: roleScore !== null ? "Based on shared words between your target roles/profile and this job title." : "Add a target role, headline, or experience title to compare." },
    { key: "location", label: "Location and work arrangement", weight: MATCH_WEIGHTS.location, available: locationScore !== null, score: locationScore, explanation: locationExplanation },
    salary,
    { key: "employment", label: "Employment type", weight: MATCH_WEIGHTS.employment, available: employmentAvailable, score: employmentScore, explanation: employmentAvailable ? (employmentScore === 100 ? "This employment type matches a stated preference." : "This employment type is outside your stated preferences.") : "Add an employment type preference to compare." },
    { key: "industry", label: "Industry", weight: MATCH_WEIGHTS.industry, available: industryAvailable, score: industryScore, explanation: industryAvailable ? (industryScore === 100 ? "This industry matches a stated preference." : "This industry is outside your stated preferences.") : "Industry preferences or listing information are missing." },
  ];
  const available = dimensions.filter((dimension) => dimension.available && dimension.score !== null);
  const totalWeight = available.reduce((sum, dimension) => sum + dimension.weight, 0);
  const score = totalWeight ? Math.round(available.reduce((sum, dimension) => sum + dimension.score! * dimension.weight, 0) / totalWeight) : null;
  return {
    score,
    description: "A comparison of the profile information you provided with the information in this job listing. It is not a probability of being hired or a hiring decision.",
    dimensions,
    matchingSkills: skillResult.matching,
    missingRequiredSkills: skillResult.missingRequired,
    missingPreferredSkills: skillResult.missingPreferred,
    notYetEvidencedSkills: skillResult.notYetEvidenced,
    scoreFactors: dimensions.filter((dimension) => dimension.score !== null && dimension.score < 100).map((dimension) => ({ dimension: dimension.label, explanation: dimension.explanation })),
    unknownDimensions: dimensions.filter((dimension) => !dimension.available).map((dimension) => dimension.label),
  };
}
