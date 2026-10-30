import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { api, errorMessage } from "../api";
import { AppHeader, Loading, Notice } from "../components";
import type { Job } from "../types";

type Question = { category: string; question: string; focus: string };
type PrepResult = { role: string; source: string; questions: Question[] };

export function InterviewPrepPage() {
  const [role, setRole] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function loadQuestions(nextRole?: string, nextJobId?: string) {
    const params = new URLSearchParams();
    if (nextRole?.trim()) params.set("role", nextRole.trim());
    if (nextJobId) params.set("jobId", nextJobId);
    const result = await api<PrepResult>("/interview-prep" + (params.size ? "?" + params.toString() : ""));
    setRole(result.role); setQuestions(result.questions); setAnswers({});
  }
  useEffect(() => {
    Promise.all([api<{ jobs: Job[] }>("/jobs"), api<PrepResult>("/interview-prep")])
      .then(([jobResult, prepResult]) => { setJobs(jobResult.jobs); setRole(prepResult.role); setQuestions(prepResult.questions); })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);
  async function refreshQuestions(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await loadQuestions(role, jobId || undefined); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  if (loading) return <Loading label="Preparing interview practice" />;
  return <>
    <AppHeader title="Practice the conversations ahead." eyebrow="Interview preparation">
      <p className="heading-description">Use these prompts to shape honest examples from your own experience. SkillBridge does not save your practice answers.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}
    <section className="form-panel interview-target-panel"><div className="form-panel-heading"><span className="panel-icon"><Lightbulb size={18} /></span><div><h2>Choose a role to prepare for</h2><p>Questions are generated locally from a role and, when selected, the listing's required skills.</p></div></div><form className="interview-target-form" onSubmit={(event) => void refreshQuestions(event)}><label>Target role<input value={role} onChange={(event) => setRole(event.target.value)} maxLength={180} required /></label><label>Or focus on a job listing<select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">Use target role</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title.replace(/^Demo role: /, "")} · {job.company.name.replace(/^Demo [—-] /, "")}</option>)}</select></label><button className="button" disabled={busy}>{busy ? "Refreshing…" : "Refresh practice set"}<ArrowRight size={15} /></button></form></section>
    <section className="interview-question-list" aria-label="Interview practice questions">{questions.map((item, index) => <article className="form-panel interview-question" key={item.category}><div className="interview-question-title"><span>{String(index + 1).padStart(2, "0")}</span><div><p className="eyebrow">{item.category}</p><h2>{item.question}</h2></div></div><div className="interview-focus"><b>Consider</b><p>{item.focus}</p></div><label>Your practice notes<textarea rows={4} value={answers[index] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))} placeholder="Write a few bullet points in your own words. These notes stay in this page while it is open." /></label></article>)}</section>
  </>;
}
