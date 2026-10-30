import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
const knownSkills = [
  "TypeScript", "JavaScript", "React", "Node.js", "Python", "SQL", "PostgreSQL",
  "Data visualization", "Figma", "Prototyping", "Accessibility", "Excel", "AWS",
  "Docker", "Git", "Project management", "Communication", "HTML", "CSS",
];
const aliases: Record<string, string> = { js: "JavaScript", ts: "TypeScript", "react.js": "React", nodejs: "Node.js", postgres: "PostgreSQL" };
const escapeRegex = (value: string) => value.replace(/[.*+?^()|[\]\\]/g, "\\$&");
export type ExtractedSuggestion = { kind: string; value: string; evidence: string };
export async function analyzeResume(bytes: Buffer, mimeType: string): Promise<{ text: string; suggestions: ExtractedSuggestion[] }> {
  const text = mimeType === "application/pdf"
    ? (await pdfParse(bytes)).text
    : (await mammoth.extractRawText({ buffer: bytes })).value;
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 100000);
  const lower = clean.toLowerCase();
  const suggestions: ExtractedSuggestion[] = [];
  const used = new Set<string>();
  for (const skill of knownSkills) {
    const key = skill.toLowerCase();
    const match = key === "javascript" || key === "typescript" || key === "react" || key === "node.js" || key === "postgresql"
      ? new RegExp("(^|[^a-z0-9])(" + escapeRegex(key) + "|(?:js|ts|react\\.js|nodejs|postgres))([^a-z0-9]|$)", "i").exec(lower)
      : new RegExp("(^|[^a-z0-9])" + escapeRegex(key) + "([^a-z0-9]|$)", "i").exec(lower);
    if (!match) continue;
    const value = aliases[match[2]?.toLowerCase() ?? ""] ?? skill;
    if (used.has(value.toLowerCase())) continue;
    used.add(value.toLowerCase());
    const start = Math.max(0, match.index - 65);
    const end = Math.min(clean.length, match.index + match[0].length + 65);
    suggestions.push({ kind: "skill", value, evidence: clean.slice(start, end).trim() });
  }
  return { text: clean, suggestions };
}
export function validResumeSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return bytes.subarray(0, 2).toString("ascii") === "PK";
  }
  return false;
}
