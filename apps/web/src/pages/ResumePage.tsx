import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowRight, Check, FileText, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { Resume } from "../types";

export function ResumePage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [replaceId, setReplaceId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [suggestionEdits, setSuggestionEdits] = useState<Record<string, string>>({});
  async function load() {
    setLoading(true);
    try {
      const result = await api<{ resumes: Resume[]; aiAvailable: boolean }>("/resumes");
      setResumes(result.resumes);
      setAiAvailable(result.aiAvailable);
      if (replaceId && !result.resumes.some((resume) => resume.id === replaceId)) setReplaceId("");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Choose a PDF or DOCX file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Your resume must be 5 MB or smaller."); return; }
    setBusy(true); setError(""); setMessage("");
    const form = new FormData();
    form.append("resume", file);
    form.append("useAi", String(useAi));
    try {
      const result = await api<{ resume: Resume }>(replaceId ? "/resumes/" + replaceId + "/replace" : "/resumes", { method: "POST", body: form });
      setFile(null);
      setMessage(result.resume.aiAssisted
        ? "Resume saved privately. AI and local suggestions are ready for your review."
        : useAi
          ? "Resume saved privately. Local review is ready; AI did not add any supported suggestions this time."
          : "Resume saved privately. Review the local suggestions below before adding them to your profile.");
      await load();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function decide(resumeId: string, suggestionId: string, decision: "confirm" | "reject", value?: string) {
    setError(""); setMessage("");
    try {
      await api("/resumes/" + resumeId + "/suggestions/" + suggestionId, {
        method: "PATCH", body: { decision, ...(decision === "confirm" && value ? { value } : {}) },
      });
      setMessage(decision === "confirm" ? "Suggestion confirmed and added to your profile." : "Suggestion dismissed.");
      await load();
    } catch (reason) { setError(errorMessage(reason)); }
  }
  async function remove(resume: Resume) {
    if (!window.confirm("Delete " + resume.originalName + " and its extracted suggestions?")) return;
    setError(""); setMessage("");
    try {
      await api("/resumes/" + resume.id, { method: "DELETE" });
      setMessage("Resume and its private file were deleted.");
      await load();
    } catch (reason) { setError(errorMessage(reason)); }
  }
  if (loading) return <Loading label="Loading your private resumes" />;
  return <>
    <AppHeader title="Resume review" eyebrow="Your story, your call">
      <p className="heading-description">Upload a PDF or DOCX for private local review. If you choose, an AI parser can also organize experience, education, projects, and skills. Every suggestion waits for your review before it can update your profile.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    <section className="form-panel resume-upload-panel">
      <div className="form-panel-heading"><span className="panel-icon"><UploadCloud size={18} /></span><div><h2>Keep a private resume</h2><p>PDF or DOCX · up to 5 MB · stored privately</p></div></div>
      <form className="resume-upload-form" onSubmit={(event) => void upload(event)}>
        <label className="file-picker"><FileText size={19} /><span>{file ? file.name : "Choose your resume file"}</span><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} aria-label="Choose a PDF or DOCX resume" /></label>
        <label className="resume-replace-select">Save as<select value={replaceId} onChange={(event) => setReplaceId(event.target.value)}><option value="">Add a new resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>Replace {resume.originalName}</option>)}</select></label>
        <button className="button" disabled={busy || !file}>{busy ? "Saving…" : replaceId ? "Replace resume" : "Upload resume"}<ArrowRight size={15} /></button>
        <label className="resume-ai-choice"><input type="checkbox" checked={useAi} disabled={!aiAvailable || busy} onChange={(event) => setUseAi(event.target.checked)} /><span><b>Use optional AI to organize this CV</b><small>{aiAvailable ? "Only when selected, up to 24,000 characters of extracted text are sent to the configured OpenAI service. Email addresses, phone numbers, and web links are removed first. AI results wait for your review." : "AI parsing is not configured on this server. Local review is available."}</small></span></label>
      </form>
      <div className="resume-privacy-note"><span className="privacy-lock">●</span><span>Resume files are never available through a public URL. Only your signed-in account can download or delete them.</span></div>
    </section>
    <section className="resume-list-section"><div className="section-title-inline"><div><p className="eyebrow">Your files</p><h2>Resumes and suggestions</h2></div><Link to="/app/profile" className="text-link">Edit profile instead <ArrowRight size={14} /></Link></div>
      {resumes.length === 0 ? <EmptyState title="No resume uploaded." body="You can add a resume for review or build your profile manually. Both paths work." action={<Link className="button button-secondary" to="/app/profile">Build profile manually</Link>} /> :
        <div className="resume-list">{resumes.map((resume) => {
          const pending = resume.suggestions.filter((suggestion) => suggestion.status === "PENDING");
          return <article className="resume-card" key={resume.id}>
            <div className="resume-card-head"><span className="resume-file-icon"><FileText size={20} /></span><div className="resume-file-meta"><h3>{resume.originalName}</h3><p>{(resume.sizeBytes / 1024).toFixed(0)} KB · uploaded {new Date(resume.createdAt).toLocaleDateString()}</p></div>
              <span className={"analysis-pill " + (resume.analysisStatus === "READY" ? "analysis-ready" : "analysis-manual")}>{resume.aiAssisted ? "AI and local review" : resume.analysisStatus === "READY" ? "Local review ready" : "Manual profile available"}</span>
              <a className="icon-button" href={"/api/resumes/" + resume.id + "/download"} aria-label={"Download " + resume.originalName}><ArrowDownToLine size={17} /></a>
              <button className="icon-button" onClick={() => setReplaceId(resume.id)} aria-label={"Replace " + resume.originalName}><RefreshCw size={16} /></button>
              <button className="icon-button icon-button-danger" onClick={() => void remove(resume)} aria-label={"Delete " + resume.originalName}><Trash2 size={16} /></button>
            </div>
            {resume.feedback && <section className="resume-feedback-card"><div className="suggestion-heading"><div><p className="eyebrow">Local resume feedback</p><h4>Structure checklist · {resume.feedback.items.filter((item) => item.found).length} of {resume.feedback.items.length} checks detected</h4></div><span>{resume.feedback.wordCount} words</span></div><div className="resume-feedback-items">{resume.feedback.items.map((item) => <article key={item.key} className={item.found ? "resume-feedback-item found" : "resume-feedback-item"}><b>{item.found ? "Found" : "Consider"}: {item.label}</b>{!item.found && <p>{item.suggestion}</p>}</article>)}</div><small>{resume.feedback.note}</small></section>}
            {pending.length > 0 ? <div className="suggestion-review"><div className="suggestion-heading"><div><p className="eyebrow">Review each idea</p><h4>{pending.length} profile {pending.length === 1 ? "suggestion" : "suggestions"} found</h4></div><span className="suggestion-pending">Needs your review</span></div>
              {pending.map((suggestion) => {
                const kind = suggestion.kind.replace(/^ai_/, "");
                const labels: Record<string, string> = { skill: "Skill", experience: "Role | company | description | start YYYY-MM | end YYYY-MM or current", education: "Qualification | institution | field", project: "Project | description | link", certification: "Certification | issuer | link", language: "Language | proficiency", targetRole: "Target role", headline: "Professional headline" };
                return <div className="suggestion-row" key={suggestion.id}><div className="suggestion-main"><label className="suggestion-edit-label"><span>{labels[kind] ?? "Suggested detail"}</span><input value={suggestionEdits[suggestion.id] ?? suggestion.value} maxLength={1000} onChange={(event) => setSuggestionEdits((current) => ({ ...current, [suggestion.id]: event.target.value }))} /></label><p><span className="suggestion-type">{suggestion.kind.startsWith("ai_") ? "AI SUGGESTION" : "LOCAL SUGGESTION"}</span>Evidence: “{suggestion.evidence}”</p></div><div className="suggestion-actions"><button className="button button-small button-confirm" disabled={!(suggestionEdits[suggestion.id] ?? suggestion.value).trim()} onClick={() => void decide(resume.id, suggestion.id, "confirm", suggestionEdits[suggestion.id] ?? suggestion.value)}><Check size={14} />Confirm</button><button className="button button-small button-quiet" onClick={() => void decide(resume.id, suggestion.id, "reject")}><X size={14} />Dismiss</button></div></div>;
              })}
            </div> : <div className="resume-review-empty">{resume.analysisStatus === "READY" ? "No unreviewed profile suggestions remain. Your confirmed profile information is still editable." : "We could not read this file locally. You can still use it for applications and complete your profile manually."}</div>}
          </article>;
        })}</div>}
    </section>
  </>;
}
