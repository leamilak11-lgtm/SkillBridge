export type ResumeFeedbackItem = {
  key: string;
  label: string;
  found: boolean;
  suggestion: string;
};

export type ResumeFeedback = {
  score: number;
  wordCount: number;
  items: ResumeFeedbackItem[];
  note: string;
};

const hasHeading = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

export function reviewResume(text: string): ResumeFeedback {
  const clean = text.replace(/\s+/g, " ").trim();
  const wordCount = clean ? clean.split(" ").length : 0;
  const hasExperience = hasHeading(clean, [/\b(experience|employment|work history|projects)\b/i]);
  const items: ResumeFeedbackItem[] = [
    {
      key: "summary",
      label: "Profile or summary",
      found: hasHeading(clean, [/\b(summary|profile|objective|about me)\b/i]),
      suggestion: "Add a short, specific introduction that names your area of work and the value you bring.",
    },
    {
      key: "skills",
      label: "Skills section",
      found: hasHeading(clean, [/\b(skills|competencies|technical strengths)\b/i]),
      suggestion: "Group the skills that matter for your target role and keep them accurate to your experience.",
    },
    {
      key: "experience",
      label: "Work or project experience",
      found: hasExperience,
      suggestion: "Describe relevant work, study, or project experience and make your own contribution clear.",
    },
    {
      key: "impact",
      label: "Evidence of results",
      found: hasExperience && /\b\d+(?:[.,]\d+)?\s*(%|percent|users|clients|hours|days|weeks|months|years|projects|records|reports|teams)?\b/i.test(clean),
      suggestion: "Where you can support it, include a concrete outcome such as volume, time saved, quality improved, or people served.",
    },
    {
      key: "education",
      label: "Education or training",
      found: hasHeading(clean, [/\b(education|qualifications|training|certifications|certificates)\b/i]),
      suggestion: "Include relevant education, training, or certifications. You can omit details that do not support your goal.",
    },
    {
      key: "length",
      label: "Readable length",
      found: wordCount >= 150 && wordCount <= 1400,
      suggestion: wordCount < 150
        ? "Add enough relevant detail for a reader to understand your experience; this check is only a rough guide."
        : "Consider trimming repeated or unrelated detail so the most relevant evidence is easy to find.",
    },
  ];
  const score = Math.round(items.filter((item) => item.found).length / items.length * 100);
  return {
    score,
    wordCount,
    items,
    note: "A local checklist of visible sections, not a measure of your ability or likelihood of being hired. Review every suggestion yourself.",
  };
}
