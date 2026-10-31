export type User = { id: string; name: string; username?: string; phone?: string | null; email: string; role: "JOB_SEEKER" | "RECRUITER" | "ADMIN" };
export type Match = {
  score: number | null;
  description: string;
  dimensions: Array<{ key: string; label: string; weight: number; available: boolean; score: number | null; explanation: string }>;
  matchingSkills: Array<{ name: string; evidence: string | null }>;
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  notYetEvidencedSkills: string[];
  scoreFactors: Array<{ dimension: string; explanation: string }>;
  unknownDimensions: string[];
};
export type Job = {
  id: string;
  title: string;
  location: string | null;
  workArrangement: string;
  employmentType: string;
  industry: string | null;
  description: string;
  responsibilities: string[];
  experienceMinYears: number | null;
  experienceMaxYears: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  applicationDeadline: string | null;
  isDemo: boolean;
  publishedAt: string | null;
  createdAt: string;
  company: { id: string; name: string; location: string | null; website?: string | null; isDemo?: boolean };
  skills: Array<{ name: string; category: string; required: boolean }>;
  match?: Match;
};
export type Profile = {
  id: string;
  userId: string;
  headline: string | null;
  location: string | null;
  biography: string | null;
  avatarUrl: string | null;
  visibilityPublic: boolean;
  desiredRoles: string[];
  desiredIndustries: string[];
  preferredLocations: string[];
  workArrangements: string[];
  employmentTypes: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  skills: Array<{
    id: string; level: string | null; yearsExperience: number | null; evidence: string | null; source: string;
    skill: { id: string; name: string; category: string };
  }>;
  experiences: Array<{ id: string; title: string; company: string; location: string | null; description: string; startDate: string | null; endDate: string | null; isCurrent: boolean }>;
  education: Array<{ id: string; institution: string; qualification: string | null; field: string | null; startDate: string | null; endDate: string | null; description: string | null }>;
  projects: Array<{ id: string; name: string; description: string; url: string | null; startDate: string | null; endDate: string | null }>;
  certifications: Array<{ id: string; name: string; issuer: string; issuedAt: string | null; expiresAt: string | null; credentialUrl: string | null }>;
  languages: Array<{ id: string; name: string; proficiency: string | null }>;
};
export type Resume = {
  id: string; originalName: string; mimeType: string; sizeBytes: number; analysisStatus: "READY" | "FAILED" | "PENDING";
  createdAt: string; suggestions: Array<{ id: string; kind: string; value: string; evidence: string; status: string }>;
  aiAssisted?: boolean;
  feedback: { score: number; wordCount: number; note: string; items: Array<{ key: string; label: string; found: boolean; suggestion: string }> } | null;
};
export type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };
export type Candidate = {
  id: string; headline: string | null; location: string | null; biography: string | null; desiredRoles: string[];
  user: { id: string; name: string };
  skills: Array<{ level: string | null; yearsExperience: number | null; evidence: string | null; skill: { name: string; category: string | null } }>;
  experiences: Array<{ title: string; company: string; description: string; startDate: string | null; endDate: string | null; isCurrent: boolean }>;
  match?: Match;
};

export type RecruiterCompany = {
  id: string; name: string; description: string | null; website: string | null; location: string | null;
  isApproved: boolean; isSuspended: boolean; isDemo: boolean; isOwner: boolean; createdAt: string;
};
export type RecruiterJob = {
  id: string; title: string; location: string | null; workArrangement: string; employmentType: string;
  industry: string | null; description: string; responsibilities: string[]; experienceMinYears: number | null;
  experienceMaxYears: number | null; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null;
  applicationDeadline: string | null; status: "DRAFT" | "PUBLISHED" | "CLOSED" | "SUSPENDED"; isDemo: boolean;
  publishedAt: string | null; createdAt: string; updatedAt: string;
  company: { id: string; name: string; location: string | null; isApproved: boolean; isDemo: boolean };
  skills: Array<{ required: boolean; skill: { id: string; name: string; category: string | null } }>;
  _count: { applications: number };
};
export type RecruiterApplication = {
  id: string; status: string; coverLetter: string | null; recruiterNotes: string | null; submittedAt: string; updatedAt: string;
  resume: { id: string; originalName: string; mimeType: string; sizeBytes: number } | null;
  user: { id: string; name: string }; job: { id: string; title: string };
  history: Array<{ status: string; note: string | null; createdAt: string }>;
};
export type AdminCompany = {
  id: string; name: string; description: string | null; website: string | null; location: string | null;
  isApproved: boolean; isSuspended: boolean; isDemo: boolean; createdAt: string;
  _count: { members: number; jobs: number; reports: number };
  members: Array<{ user: { id: string; name: string; email: string } }>;
};
export type AdminJob = {
  id: string; title: string; location: string | null; status: RecruiterJob["status"];
  updatedAt: string; company: { id: string; name: string; isApproved: boolean; isSuspended: boolean };
  _count: { applications: number; reports: number };
};
export type AdminReport = {
  id: string; reason: string; status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"; createdAt: string;
  author: { id: string; name: string } | null;
  job: { id: string; title: string; status: string; company: { id: string; name: string } } | null;
  company: { id: string; name: string; isApproved: boolean; isSuspended: boolean } | null;
};
export type AdminUser = {
  id: string; name: string; email: string; role: User["role"]; isSuspended: boolean; createdAt: string;
};
