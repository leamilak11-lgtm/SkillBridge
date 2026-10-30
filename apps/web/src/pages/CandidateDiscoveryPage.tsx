import { useEffect, useState, type FormEvent } from "react";
import { Search, UserRound } from "lucide-react";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { Candidate, RecruiterJob } from "../types";

type CandidateResult = {
  candidates: Candidate[];
  page: number;
  pageSize: number;
  total: number;
  matchPoolLimited: boolean;
  contactDetailsIncluded: false;
};

export function CandidateDiscoveryPage() {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [result, setResult] = useState<CandidateResult | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ jobs: RecruiterJob[] }>("/recruiter/jobs")
      .then((response) => setJobs(response.jobs))
      .catch((reason) => setError(errorMessage(reason)));
  }, []);

  async function search(event?: FormEvent, nextPage = 1) {
    event?.preventDefault(); setLoading(true); setError(""); setPage(nextPage); setSearched(true);
    const params = new URLSearchParams({ page: String(nextPage) });
    if (query.trim()) params.set("q", query.trim());
    if (skill.trim()) params.set("skill", skill.trim());
    if (jobId) params.set("jobId", jobId);
    try { setResult(await api<CandidateResult>("/recruiter/candidates?" + params.toString())); }
    catch (reason) { setError(errorMessage(reason)); setResult(null); }
    finally { setLoading(false); }
  }

  const selectedJob = jobs.find((job) => job.id === jobId);
  return <>
    <AppHeader title={selectedJob ? "Find matches for your role." : "Find opted-in candidates."} eyebrow="Candidate discovery">
      <p className="heading-description">Search profiles whose owners enabled recruiter discovery. Match scores compare only shared profile details with your selected job; they support review and never make a hiring decision.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}
    <section className="form-panel candidate-search-panel">
      <div className="form-panel-heading"><span className="panel-icon"><Search size={18} /></span><div><h2>Search public profile details</h2><p>Results include only people who explicitly enabled recruiter discovery.</p></div></div>
      <form className="candidate-search-form" onSubmit={(event) => void search(event)}>
        <label>Match to a job <span className="optional-label">Optional</span><select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">Browse by profile details</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.status.toLowerCase()}</option>)}</select></label>
        <label>Name, headline, location, or target role<input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} /></label>
        <label>Skill<input value={skill} onChange={(event) => setSkill(event.target.value)} maxLength={100} placeholder="e.g. SQL" /></label>
        <button className="button"><Search size={15} />{jobId ? "Find job matches" : "Search candidates"}</button>
      </form>
    </section>
    {loading ? <Loading label="Searching consented profiles" /> : searched && result && <section className="candidate-results">
      <div className="section-title-inline"><div><p className="eyebrow">{selectedJob ? `Local profile match for ${selectedJob.title}` : "Consent-based results"}</p><h2>{result.total} {result.total === 1 ? "candidate" : "candidates"}</h2></div></div>
      {result.matchPoolLimited && <Notice kind="info">Scores are shown for the 500 most recently updated profiles that match these filters. Narrow the search to focus the review.</Notice>}
      {result.candidates.length === 0 ? <EmptyState title="No opted-in profiles match." body="Try a broader name or skill search. Profiles that remain private will not appear." /> : <div className="candidate-list">{result.candidates.map((candidate) => <article className="form-panel candidate-card" key={candidate.user.id}>
        <div className="candidate-card-heading"><span className="candidate-avatar"><UserRound size={18} /></span><div><p className="eyebrow">{candidate.location ?? "Location not supplied"}</p><h3>{candidate.user.name}</h3><strong>{candidate.headline ?? candidate.desiredRoles[0] ?? "Career profile"}</strong></div>{candidate.match && <span className="candidate-match-score">{candidate.match.score === null ? "More profile details needed" : `${candidate.match.score}% profile match`}</span>}<span className="consent-badge">Opted in</span></div>
        {candidate.biography && <p className="candidate-bio">{candidate.biography}</p>}
        {candidate.desiredRoles.length > 0 && <p className="candidate-targets"><b>Target roles:</b> {candidate.desiredRoles.join(", ")}</p>}
        {candidate.skills.length > 0 && <div className="candidate-skills">{candidate.skills.map((entry) => <span className="skill-chip" key={entry.skill.name}>{entry.skill.name}{entry.level ? ` · ${entry.level.toLowerCase()}` : ""}</span>)}</div>}
        {candidate.match && <p className="candidate-match-copy">{candidate.match.matchingSkills.length ? `Profile skills shared with the role: ${candidate.match.matchingSkills.map((item) => item.name).join(", ")}.` : "No matching listed skill evidence was found in the shared profile."}{candidate.match.missingRequiredSkills.length ? ` Skills not shown in the profile: ${candidate.match.missingRequiredSkills.join(", ")}.` : ""}</p>}
        {candidate.experiences.length > 0 && <div className="candidate-experience"><b>Experience shared</b>{candidate.experiences.map((entry, index) => <p key={`${entry.title}-${index}`}><strong>{entry.title}</strong> · {entry.company}<small>{entry.description}</small></p>)}</div>}
        <p className="candidate-contact-note">Contact details and private resumes are not included. Review shared evidence directly; the match score is only a comparison aid.</p>
      </article>)}</div>}
      {result.total > result.pageSize && <div className="candidate-pagination"><button className="button button-secondary button-small" disabled={page <= 1} onClick={() => void search(undefined, page - 1)}>Previous</button><span>Page {page} of {Math.ceil(result.total / result.pageSize)}</span><button className="button button-secondary button-small" disabled={page >= Math.ceil(result.total / result.pageSize)} onClick={() => void search(undefined, page + 1)}>Next</button></div>}
    </section>}
    {!searched && <div className="candidate-consent-note"><UserRound size={16} /><span>Only opted-in public fields are used: name, headline, location, role interests, skills, experience, and biography. Email, private resumes, applications, and private notes remain hidden.</span></div>}
  </>;
}
