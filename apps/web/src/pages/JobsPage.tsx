import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bookmark, BriefcaseBusiness, Check, CircleHelp, Flag, MapPin, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Footer, Loading, Notice, SiteHeader } from "../components";
import type { Job, Resume } from "../types";
import { JobCard } from "./JobCard";

type Filters = { q: string; location: string; workArrangement: string; employmentType: string; skill: string; company: string; salaryMin: string; salaryMax: string; experienceMax: string; postedWithin: string };
const emptyFilters: Filters = { q: "", location: "", workArrangement: "", employmentType: "", skill: "", company: "", salaryMin: "", salaryMax: "", experienceMax: "", postedWithin: "" };
const friendly = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export function JobsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function search(next = filters) {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    try {
      const result = await api<{ jobs: Job[]; total: number }>("/jobs?" + params.toString());
      setJobs(result.jobs); setTotal(result.total);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void search(); }, []);
  function change(key: keyof Filters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }
  return <><SiteHeader /><main className="public-page">
    <div className="public-page-title"><p className="eyebrow">Your next opportunity</p><h1>Find work that fits.</h1><p>Explore real job requirements and see where your experience connects.</p></div>
    <form className="job-filter-panel" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <div className="filter-search-row">
        <label className="filter-field"><span>Role or keyword</span><input value={filters.q} onChange={(event) => change("q", event.target.value)} placeholder="e.g. Product designer" /></label>
        <label className="filter-field"><span>Location</span><input value={filters.location} onChange={(event) => change("location", event.target.value)} placeholder="City, region or remote" /></label>
        <button className="button filter-submit">Search roles <ArrowRight size={16} /></button>
      </div>
      <div className="filter-secondary-row">
        <label className="filter-field"><span>Work arrangement</span><select value={filters.workArrangement} onChange={(event) => change("workArrangement", event.target.value)}><option value="">Any arrangement</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option><option value="ONSITE">On-site</option></select></label>
        <label className="filter-field"><span>Employment type</span><select value={filters.employmentType} onChange={(event) => change("employmentType", event.target.value)}><option value="">Any type</option><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERNSHIP">Internship</option><option value="TEMPORARY">Temporary</option></select></label>
        <label className="filter-field"><span>Skill</span><input value={filters.skill} onChange={(event) => change("skill", event.target.value)} placeholder="e.g. SQL" /></label>
        <label className="filter-field"><span>Posted</span><select value={filters.postedWithin} onChange={(event) => change("postedWithin", event.target.value)}><option value="">Any time</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label>
      </div>
      <div className="filter-tertiary-row">
        <label className="filter-field"><span>Minimum salary</span><input type="number" min="0" value={filters.salaryMin} onChange={(event) => change("salaryMin", event.target.value)} placeholder="Any" /></label>
        <label className="filter-field"><span>Maximum salary</span><input type="number" min="0" value={filters.salaryMax} onChange={(event) => change("salaryMax", event.target.value)} placeholder="Any" /></label>
        <label className="filter-field"><span>Maximum experience (years)</span><input type="number" min="0" max="60" step="0.5" value={filters.experienceMax} onChange={(event) => change("experienceMax", event.target.value)} placeholder="Any" /></label>
        <label className="filter-field"><span>Company</span><input value={filters.company} onChange={(event) => change("company", event.target.value)} placeholder="Company name" /></label>
        <button type="button" className="filter-reset" onClick={() => { setFilters(emptyFilters); void search(emptyFilters); }}>Clear filters</button>
      </div>
    </form>
    <div className="results-bar"><span>{loading ? "Searching…" : total + " " + (total === 1 ? "opportunity" : "opportunities")}</span><span>All demo listings are marked clearly</span></div>
    {error && <Notice kind="error">{error}</Notice>}
    {loading ? <Loading label="Finding relevant opportunities" /> : jobs.length
      ? <div className="job-list-grid">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
      : <EmptyState title="No roles match those filters." body="Try a broader search or clear one of the filters to see more listings." action={<button className="button button-secondary" onClick={() => { setFilters(emptyFilters); void search(emptyFilters); }}>Clear filters</button>} />}
  </main><Footer /></>;
}

export function JobDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api<{ job: Job; saved: boolean; applied: boolean }>("/jobs/" + id);
      setJob(result.job); setSaved(result.saved); setApplied(result.applied);
      if (user?.role === "JOB_SEEKER") {
        const resumeResult = await api<{ resumes: Resume[] }>("/resumes");
        setResumes(resumeResult.resumes);
      }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id, user?.id]);
  async function toggleSave() {
    if (!job) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (saved) { await api("/jobs/" + job.id + "/save", { method: "DELETE" }); setSaved(false); setNotice("Removed from your saved jobs."); }
      else { await api("/jobs/" + job.id + "/save", { method: "POST" }); setSaved(true); setNotice("Saved. You can come back to this role any time."); }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function apply(event: FormEvent) {
    event.preventDefault();
    if (!job) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/jobs/" + job.id + "/apply", { method: "POST", body: { resumeId: resumeId || null, coverLetter: coverLetter.trim() || null } });
      setApplied(true); setNotice("Application submitted. Track it from your applications page.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!job) return;
    setReportBusy(true); setReportError(""); setReportMessage("");
    try {
      await api("/reports", { method: "POST", body: { jobId: job.id, reason: reportReason.trim() } });
      setReportMessage("Thanks. Your report is in the moderation queue."); setReportReason(""); setReportOpen(false);
    } catch (reason) { setReportError(errorMessage(reason)); }
    finally { setReportBusy(false); }
  }
  if (loading) return <><SiteHeader /><main className="public-page"><Loading label="Loading opportunity" /></main><Footer /></>;
  if (error && !job) return <><SiteHeader /><main className="public-page"><Notice kind="error">{error}</Notice><Link className="back-link" to="/jobs"><ArrowLeft size={15} />Back to jobs</Link></main><Footer /></>;
  if (!job) return <><SiteHeader /><main className="public-page"><EmptyState title="This role is unavailable." body="It may have closed or moved." action={<Link className="button" to="/jobs">Browse jobs</Link>} /></main><Footer /></>;
  const isSeeker = user?.role === "JOB_SEEKER";
  return <><SiteHeader /><main className="public-page job-detail-page">
    <Link className="back-link" to="/jobs"><ArrowLeft size={15} />All opportunities</Link>
    <div className="job-detail-grid">
      <div className="job-detail-main">
        <div className="detail-company-row"><div className="company-monogram company-monogram-large">{job.company.name.replace(/^Demo — /, "").slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">{job.company.name.replace(/^Demo — /, "")}{job.isDemo && <span className="demo-badge">Demo listing</span>}</p><h1>{job.title.replace(/^Demo role: /, "")}</h1></div></div>
        <div className="job-meta job-meta-detail"><span><MapPin size={15} />{job.location || "Location not specified"}</span><span><BriefcaseBusiness size={15} />{friendly(job.employmentType)}</span><span>{friendly(job.workArrangement)}</span>{(job.salaryMin !== null || job.salaryMax !== null) && <span>{job.salaryCurrency ?? ""} {job.salaryMin?.toLocaleString() ?? "—"}–{job.salaryMax?.toLocaleString() ?? "—"}</span>}{job.applicationDeadline && <span>Apply by {new Date(job.applicationDeadline).toLocaleDateString()}</span>}</div>
        <div className="job-detail-card"><h2>About this role</h2><p>{job.description}</p>{job.responsibilities.length > 0 && <><h3>What you might do</h3><ul>{job.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></>}</div>
        <div className="job-detail-card"><h2>Skills and experience</h2><div className="job-skills job-skills-large">{job.skills.map((skill) => <span className={skill.required ? "skill-chip" : "skill-chip skill-chip-soft"} key={skill.name}>{skill.name}<small>{skill.required ? "Required" : "Preferred"}</small></span>)}</div>{job.experienceMinYears !== null && <p className="detail-note">Experience listed: {job.experienceMinYears}+ years</p>}</div>
        {isSeeker && <section className="apply-card"><div className="section-title-inline"><h2>{applied ? "You're in the loop." : "Apply to this role"}</h2>{applied && <span className="status-pill status-applied"><Check size={13} />Applied</span>}</div>
          {applied ? <p>Your application is saved to your tracker. You can add personal notes and follow its progress there.</p> : <form className="form-stack" onSubmit={(event) => void apply(event)}>
            <label>Resume to share<select value={resumeId} onChange={(event) => setResumeId(event.target.value)}><option value="">Apply without a resume</option>{resumes.map((resume) => <option value={resume.id} key={resume.id}>{resume.originalName}</option>)}</select><small>Your resume stays private and is shared only with this application.</small></label>
            {resumes.length === 0 && <Notice kind="info">You can upload a private resume first, or apply without one.</Notice>}
            <label>Cover letter <span className="optional-label">Optional</span><textarea rows={5} maxLength={5000} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Share a few relevant details in your own words." /></label>
            <button className="button" disabled={busy}>{busy ? "Submitting…" : "Submit application"}<ArrowRight size={16} /></button>
          </form>}
        </section>}
        {!user && <div className="apply-card apply-sign-in"><div><p className="eyebrow">Ready for a next step?</p><h2>Sign in to apply or save this role.</h2></div><Link className="button" to="/sign-in">Sign in <ArrowRight size={15} /></Link></div>}
        {user && !isSeeker && <div className="apply-card"><p className="eyebrow">Candidate applications</p><h2>Recruiter accounts cannot apply to roles.</h2><p>Use your recruiter workspace to publish listings and manage submitted applications.</p></div>}
      </div>
      <aside className="job-detail-aside">
        <div className="aside-action-card">{isSeeker || !user ? <button className={"button " + (saved ? "button-secondary" : "")} onClick={() => isSeeker ? void toggleSave() : window.location.assign("/sign-in")} disabled={busy}><Bookmark size={16} fill={saved ? "currentColor" : "none"} />{saved ? "Saved for later" : "Save this role"}</button> : <p className="detail-note">Saving jobs is available to seeker accounts.</p>}{notice && <Notice kind="success">{notice}</Notice>}{error && <Notice kind="error">{error}</Notice>}
          {user && <div className="listing-report"><button type="button" className="report-toggle" onClick={() => { setReportOpen((current) => !current); setReportError(""); }}><Flag size={14} />Report this listing</button>{reportMessage && <Notice kind="success">{reportMessage}</Notice>}{reportOpen && <form className="form-stack" onSubmit={(event) => void submitReport(event)}><label>What should we review?<textarea rows={3} required minLength={10} maxLength={1000} value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Describe the concern. This is only visible to our moderation team." /></label>{reportError && <Notice kind="error">{reportError}</Notice>}<button className="button button-secondary button-small" disabled={reportBusy}>{reportBusy ? "Sending…" : "Send report"}</button></form>}</div>}
        </div>
        <MatchCard match={job.match} />
      </aside>
    </div>
  </main><Footer /></>;
}

function MatchCard({ match }: { match?: Job["match"] }) {
  if (!match) return <aside className="match-card match-unknown"><div className="match-card-icon"><Sparkles size={18} /></div><p className="eyebrow">Your match view</p><h2>See where your profile connects.</h2><p>Sign in and add profile details to get a transparent comparison with this role.</p><Link className="arrow-link" to="/sign-up">Create your profile <ArrowRight size={15} /></Link></aside>;
  return <aside className="match-card">
    <div className="match-card-top"><div><p className="eyebrow">Profile comparison</p><h2>{match.score === null ? "Not enough info yet" : match.score + "% fit"}</h2></div><div className="match-score-ring">{match.score === null ? <CircleHelp size={20} /> : match.score}</div></div>
    <p className="match-explainer">{match.description}</p>
    <div className="match-dimension-list">{match.dimensions.map((dimension) => <div className="match-dimension" key={dimension.key}><div><span>{dimension.label}</span><strong>{dimension.score === null ? "Unknown" : dimension.score + "%"}</strong></div>{dimension.score !== null && <div className="dimension-track"><span style={{ width: dimension.score + "%" }} /></div>}<small>{dimension.explanation}</small></div>)}</div>
    {(match.matchingSkills.length > 0 || match.missingRequiredSkills.length > 0 || match.notYetEvidencedSkills.length > 0) && <div className="match-skill-detail">
      <h3><Sparkles size={15} />Skill evidence</h3>
      {match.matchingSkills.map((skill) => <p className="skill-evidence-line" key={skill.name}><Check size={13} /><span><b>{skill.name}</b>{skill.evidence && <small>{skill.evidence}</small>}</span></p>)}
      {match.missingRequiredSkills.map((skill) => <p className="skill-gap-line" key={skill}><X size={13} /><span><b>{skill}</b><small>Required · not yet in your profile</small></span></p>)}
      {match.missingPreferredSkills.map((skill) => <p className="skill-gap-line skill-preferred" key={skill}><CircleHelp size={13} /><span><b>{skill}</b><small>Preferred · not yet in your profile</small></span></p>)}
      {match.notYetEvidencedSkills.map((skill) => <p className="skill-gap-line skill-preferred" key={skill}><CircleHelp size={13} /><span><b>{skill}</b><small>Add profile evidence to compare</small></span></p>)}
    </div>}
    <Link className="match-update-link" to="/app/profile">Update profile evidence <ArrowRight size={14} /></Link>
  </aside>;
}
