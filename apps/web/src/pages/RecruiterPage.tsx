import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, Building2, Check, CircleHelp, FileText, Plus, Save, Trash2, Users } from "lucide-react";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { RecruiterApplication, RecruiterCompany, RecruiterJob } from "../types";

type JobDraft = {
  title: string; location: string; workArrangement: string; employmentType: string; industry: string;
  description: string; responsibilities: string; experienceMinYears: string; experienceMaxYears: string;
  salaryMin: string; salaryMax: string; salaryCurrency: string; applicationDeadline: string; skills: string;
};
const blankJob: JobDraft = {
  title: "", location: "", workArrangement: "REMOTE", employmentType: "FULL_TIME", industry: "",
  description: "", responsibilities: "", experienceMinYears: "", experienceMaxYears: "",
  salaryMin: "", salaryMax: "", salaryCurrency: "", applicationDeadline: "", skills: "",
};
const cleanLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const friendly = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const numberOrNull = (value: string) => value.trim() ? Number(value) : null;
function toDraft(job: RecruiterJob): JobDraft {
  return {
    title: job.title, location: job.location ?? "", workArrangement: job.workArrangement,
    employmentType: job.employmentType, industry: job.industry ?? "", description: job.description,
    responsibilities: job.responsibilities.join("\n"), experienceMinYears: job.experienceMinYears?.toString() ?? "",
    experienceMaxYears: job.experienceMaxYears?.toString() ?? "", salaryMin: job.salaryMin?.toString() ?? "",
    salaryMax: job.salaryMax?.toString() ?? "", salaryCurrency: job.salaryCurrency ?? "",
    applicationDeadline: job.applicationDeadline?.slice(0, 10) ?? "",
    skills: job.skills.map(({ skill, required }) => `${skill.name} | ${required ? "Required" : "Preferred"}`).join("\n"),
  };
}

export function RecruiterPage() {
  const [company, setCompany] = useState<RecruiterCompany | null>(null);
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [companyForm, setCompanyForm] = useState({ name: "", description: "", website: "", location: "" });
  const [jobForm, setJobForm] = useState(blankJob);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api<{ company: RecruiterCompany; jobs: RecruiterJob[] }>("/recruiter/jobs");
      setCompany(result.company); setJobs(result.jobs);
      setCompanyForm({ name: result.company.name, description: result.company.description ?? "", website: result.company.website ?? "", location: result.company.location ?? "" });
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function saveCompany(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ company: RecruiterCompany }>("/recruiter/company", {
        method: "PATCH", body: {
          name: companyForm.name.trim(), description: companyForm.description.trim() || null,
          website: companyForm.website.trim() || null, location: companyForm.location.trim() || null,
        },
      });
      setCompany(result.company); setNotice("Company details saved.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  function editJob(job: RecruiterJob) { setSelectedJobId(job.id); setJobForm(toDraft(job)); setNotice(""); }
  function startNewJob() { setSelectedJobId(null); setJobForm(blankJob); setNotice(""); }
  function updateJobForm(key: keyof JobDraft, value: string) { setJobForm((current) => ({ ...current, [key]: value })); }
  async function saveJob(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const body = {
      ...jobForm,
      location: jobForm.location.trim() || null,
      industry: jobForm.industry.trim() || null,
      responsibilities: cleanLines(jobForm.responsibilities),
      experienceMinYears: numberOrNull(jobForm.experienceMinYears),
      experienceMaxYears: numberOrNull(jobForm.experienceMaxYears),
      salaryMin: numberOrNull(jobForm.salaryMin),
      salaryMax: numberOrNull(jobForm.salaryMax),
      salaryCurrency: jobForm.salaryCurrency.trim().toUpperCase() || null,
      applicationDeadline: jobForm.applicationDeadline ? `${jobForm.applicationDeadline}T23:59:00.000Z` : null,
      skills: cleanLines(jobForm.skills).map((line) => {
        const [name = "", preference = ""] = line.split("|").map((part) => part.trim());
        return { name, required: preference.toLowerCase() !== "preferred" };
      }),
    };
    try {
      const result = selectedJobId
        ? await api<{ job: RecruiterJob }>(`/recruiter/jobs/${selectedJobId}`, { method: "PATCH", body })
        : await api<{ job: RecruiterJob }>("/recruiter/jobs", { method: "POST", body });
      setSelectedJobId(result.job.id); setJobForm(toDraft(result.job));
      await load(); setNotice("Draft saved. Review it and publish when it is ready.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function setJobStatus(job: RecruiterJob, status: "DRAFT" | "PUBLISHED" | "CLOSED") {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/recruiter/jobs/${job.id}/status`, { method: "PATCH", body: { status } });
      if (selectedJobId === job.id) setSelectedJobId(job.id);
      await load(); setNotice(status === "PUBLISHED" ? "Your job is live." : status === "CLOSED" ? "This job is closed to new applications." : "Job returned to draft.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function deleteDraft(job: RecruiterJob) {
    if (!window.confirm("Delete this draft job? This cannot be undone.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/recruiter/jobs/${job.id}`, { method: "DELETE" });
      if (selectedJobId === job.id) startNewJob();
      await load(); setNotice("Draft deleted.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  if (loading) return <Loading label="Loading recruiter workspace" />;
  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  return <>
    <AppHeader title="Recruiter workspace" eyebrow="Your company and opportunities">
      <p>Keep your company information current, shape clear job listings, and follow each role through its applications.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}{notice && <Notice kind="success">{notice}</Notice>}
    {company && !company.isApproved && <Notice kind="info">Your company is awaiting administrator review. You can prepare drafts while it is reviewed; publishing unlocks after approval.</Notice>}
    {company?.isSuspended && <Notice kind="error">Company access is suspended. Job editing and publishing are unavailable.</Notice>}

    <section className="form-panel recruiter-company-panel">
      <div className="form-panel-heading"><span className="panel-icon"><Building2 size={18} /></span><div><h2>Company details</h2><p>These details help job seekers understand who is hiring.</p></div>
        {company?.isApproved && <span className="status-pill status-published"><Check size={13} />Approved</span>}
      </div>
      <form className="form-stack" onSubmit={(event) => void saveCompany(event)}>
        <div className="form-grid"><label>Company name<input required minLength={2} maxLength={180} value={companyForm.name} onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Website <span className="optional-label">Optional</span><input type="url" maxLength={500} placeholder="https://example.com" value={companyForm.website} onChange={(event) => setCompanyForm((current) => ({ ...current, website: event.target.value }))} /></label>
          <label>Location <span className="optional-label">Optional</span><input maxLength={180} value={companyForm.location} onChange={(event) => setCompanyForm((current) => ({ ...current, location: event.target.value }))} placeholder="e.g. Addis Ababa, Ethiopia" /></label>
          <label>Company description <span className="optional-label">Optional</span><textarea rows={3} maxLength={3000} value={companyForm.description} onChange={(event) => setCompanyForm((current) => ({ ...current, description: event.target.value }))} /></label>
        </div>
        <div className="form-actions"><span>{company?.isOwner ? "Only company owners can update company details." : "A company owner must update these details."}</span><button className="button button-secondary" disabled={busy || !company?.isOwner}><Save size={15} />Save company</button></div>
      </form>
    </section>

    <section className="form-panel recruiter-jobs-panel">
      <div className="form-panel-heading"><span className="panel-icon"><BriefcaseBusiness size={18} /></span><div><h2>Job listings</h2><p>{jobs.length} {jobs.length === 1 ? "role" : "roles"} across drafts and published listings.</p></div>
        <button type="button" className="button button-secondary button-small" onClick={startNewJob}><Plus size={15} />New job</button>
      </div>
      {jobs.length === 0 ? <EmptyState title="Your first job is a blank page." body="Start with a clear role, a practical description, and the skills that matter." action={<button type="button" className="button" onClick={startNewJob}>Create a job <ArrowRight size={15} /></button>} />
        : <div className="recruiter-job-list">{jobs.map((job) => <article className="recruiter-job-row" key={job.id}>
          <div className="recruiter-job-title"><span className={`status-pill status-${job.status.toLowerCase()}`}>{friendly(job.status)}</span><h3>{job.title}</h3><p>{friendly(job.workArrangement)} · {friendly(job.employmentType)}{job.location ? ` · ${job.location}` : ""}</p></div>
          <div className="recruiter-job-stats"><span><Users size={14} />{job._count.applications} applications</span><span><FileText size={14} />{job.skills.length} listed skills</span></div>
          <div className="recruiter-job-actions"><button type="button" className="button button-secondary button-small" onClick={() => editJob(job)}>Edit</button>
            {job.status === "DRAFT" && <button type="button" className="button button-small" disabled={busy || !company?.isApproved} onClick={() => void setJobStatus(job, "PUBLISHED")}>Publish</button>}
            {job.status === "PUBLISHED" && <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => void setJobStatus(job, "CLOSED")}>Close role</button>}
            {job.status === "CLOSED" && <button type="button" className="button button-secondary button-small" disabled={busy || !company?.isApproved} onClick={() => void setJobStatus(job, "PUBLISHED")}>Reopen</button>}
            {job.status === "DRAFT" && <button type="button" className="icon-button" aria-label={`Delete draft ${job.title}`} disabled={busy} onClick={() => void deleteDraft(job)}><Trash2 size={15} /></button>}
          </div>
        </article>)}</div>}
    </section>

    <section className="form-panel recruiter-job-editor">
      <div className="form-panel-heading"><span className="panel-icon"><FileText size={18} /></span><div><h2>{selectedJob ? `Edit ${selectedJob.title}` : "Draft a job listing"}</h2><p>Use plain language and specific requirements. You can keep a draft until it is ready.</p></div></div>
      <form className="form-stack" onSubmit={(event) => void saveJob(event)}>
        <div className="form-grid">
          <label>Job title<input required maxLength={180} value={jobForm.title} onChange={(event) => updateJobForm("title", event.target.value)} placeholder="e.g. Product designer" /></label>
          <label>Industry <span className="optional-label">Optional</span><input maxLength={100} value={jobForm.industry} onChange={(event) => updateJobForm("industry", event.target.value)} /></label>
          <label>Location <span className="optional-label">Optional for remote roles</span><input maxLength={180} value={jobForm.location} onChange={(event) => updateJobForm("location", event.target.value)} /></label>
          <label>Work arrangement<select value={jobForm.workArrangement} onChange={(event) => updateJobForm("workArrangement", event.target.value)}><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option><option value="ONSITE">On-site</option></select></label>
          <label>Employment type<select value={jobForm.employmentType} onChange={(event) => updateJobForm("employmentType", event.target.value)}><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERNSHIP">Internship</option><option value="TEMPORARY">Temporary</option></select></label>
          <label>Application deadline <span className="optional-label">Optional</span><input type="date" value={jobForm.applicationDeadline} onChange={(event) => updateJobForm("applicationDeadline", event.target.value)} /></label>
          <label>Job description<textarea rows={6} required maxLength={10000} value={jobForm.description} onChange={(event) => updateJobForm("description", event.target.value)} placeholder="Describe the role, who they will work with, and what success can look like." /></label>
          <label>Responsibilities, one per line <span className="optional-label">Optional</span><textarea rows={4} maxLength={10000} value={jobForm.responsibilities} onChange={(event) => updateJobForm("responsibilities", event.target.value)} placeholder={"Plan a project\nWork with a cross-functional team"} /></label>
          <label>Skills, one per line: skill | required or preferred<textarea rows={4} value={jobForm.skills} onChange={(event) => updateJobForm("skills", event.target.value)} placeholder={"Research | Required\nFigma | Preferred"} /></label>
          <div className="salary-fields"><label>Minimum experience (years)<input type="number" min="0" max="60" step="0.5" value={jobForm.experienceMinYears} onChange={(event) => updateJobForm("experienceMinYears", event.target.value)} /></label><label>Maximum experience (years)<input type="number" min="0" max="60" step="0.5" value={jobForm.experienceMaxYears} onChange={(event) => updateJobForm("experienceMaxYears", event.target.value)} /></label></div>
          <div className="salary-fields"><label>Salary minimum<input type="number" min="0" value={jobForm.salaryMin} onChange={(event) => updateJobForm("salaryMin", event.target.value)} /></label><label>Salary maximum<input type="number" min="0" value={jobForm.salaryMax} onChange={(event) => updateJobForm("salaryMax", event.target.value)} /></label><label>Currency<input maxLength={3} value={jobForm.salaryCurrency} onChange={(event) => updateJobForm("salaryCurrency", event.target.value.toUpperCase())} placeholder="ETB" /></label></div>
        </div>
        <div className="form-actions"><span>{selectedJob ? `Current status: ${friendly(selectedJob.status)}` : "New jobs start as a draft."}</span><div><button type="button" className="button button-quiet" onClick={startNewJob}>Clear form</button><button className="button" disabled={busy}><Save size={15} />{busy ? "Saving…" : "Save draft"}</button></div></div>
      </form>
    </section>
    <div className="recruiter-approval-note"><CircleHelp size={15} /><span>Publishing is available after an administrator reviews the company profile. Listings are visible only while published and the company is approved.</span></div>
  </>;
}

type ApplicationEdit = { status: string; recruiterNotes: string };
const statusOptions: Record<string, string[]> = {
  APPLIED: ["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"],
  UNDER_REVIEW: ["UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED"],
  INTERVIEW: ["INTERVIEW", "OFFER", "REJECTED"],
  OFFER: ["OFFER"], REJECTED: ["REJECTED"], WITHDRAWN: ["WITHDRAWN"],
};
export function RecruiterApplicationsPage() {
  const [applications, setApplications] = useState<RecruiterApplication[]>([]);
  const [edits, setEdits] = useState<Record<string, ApplicationEdit>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api<{ applications: RecruiterApplication[] }>("/recruiter/applications");
      setApplications(result.applications);
      setEdits(Object.fromEntries(result.applications.map((item) => [item.id, { status: item.status, recruiterNotes: item.recruiterNotes ?? "" }])));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(application: RecruiterApplication) {
    const edit = edits[application.id];
    if (!edit) return;
    setBusyId(application.id); setError(""); setNotice("");
    try {
      await api(`/recruiter/applications/${application.id}`, { method: "PATCH", body: { status: edit.status, recruiterNotes: edit.recruiterNotes.trim() || null } });
      await load(); setNotice("Application update saved.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusyId(""); }
  }
  if (loading) return <Loading label="Loading applications" />;
  return <>
    <AppHeader title="Applications" eyebrow="A clear view of each next step">
      <p>Review information applicants chose to share for your roles. Status changes are recorded in the application history.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}{notice && <Notice kind="success">{notice}</Notice>}
    {applications.length === 0 ? <EmptyState title="No applications yet." body="When people apply for a role at your company, their application will appear here." /> :
      <div className="recruiter-applications-list">{applications.map((application) => {
        const edit = edits[application.id] ?? { status: application.status, recruiterNotes: application.recruiterNotes ?? "" };
        return <article className="form-panel recruiter-application-card" key={application.id}>
          <div className="recruiter-application-head"><div><p className="eyebrow">{application.job.title}</p><h2>{application.user.name}</h2><p>Applied {new Date(application.submittedAt).toLocaleDateString()}</p></div><span className={`status-pill status-${application.status.toLowerCase()}`}>{friendly(application.status)}</span></div>
          {application.coverLetter && <div className="applicant-cover-letter"><h3>Cover letter</h3><p>{application.coverLetter}</p></div>}
          <div className="form-grid recruiter-application-controls">
            <label>Application status<select value={edit.status} onChange={(event) => setEdits((current) => ({ ...current, [application.id]: { ...edit, status: event.target.value } }))}>{(statusOptions[application.status] ?? [application.status]).map((status) => <option key={status} value={status}>{friendly(status)}</option>)}</select><small>Applicants can see status changes in their tracker.</small></label>
            <label>Recruiter notes<textarea rows={3} maxLength={4000} value={edit.recruiterNotes} onChange={(event) => setEdits((current) => ({ ...current, [application.id]: { ...edit, recruiterNotes: event.target.value } }))} placeholder="Private notes for your team" /><small>These notes are visible only to authorized company recruiters.</small></label>
          </div>
          <div className="recruiter-application-actions"><span>{application.resume ? <a className="arrow-link" href={`/api/recruiter/applications/${application.id}/resume`} download><FileText size={15} />Download {application.resume.originalName}</a> : "No resume attached"}</span><button className="button button-secondary button-small" disabled={busyId === application.id} onClick={() => void save(application)}><Save size={14} />Save update</button></div>
          {application.history.length > 0 && <details className="application-history-details"><summary>Status history</summary><ul>{application.history.map((item, index) => <li key={`${item.status}-${index}`}><span>{friendly(item.status)}</span><time>{new Date(item.createdAt).toLocaleString()}</time></li>)}</ul></details>}
        </article>;
      })}</div>}
  </>;
}
