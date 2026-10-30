import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { Match } from "../types";

type Recommendation = {
  id: string; title: string; company: string; location: string | null; isDemo: boolean; skills: string[]; match: Match | null;
};
type Result = { role: string; summary: string; source: "OPTIONAL_AI" | "LOCAL_RULES"; aiAvailable: boolean; opportunities: Recommendation[] };

export function RecommendationsPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [aiOptIn, setAiOptIn] = useState(false);
  async function load(role = roleInput, includeAi = aiOptIn) {
    setLoading(true); setError("");
    const params = new URLSearchParams({ ai: includeAi ? "true" : "false" });
    if (role.trim()) params.set("role", role.trim());
    try {
      const next = await api<Result>("/recommendations?" + params.toString());
      setResult(next);
      if (!role.trim() && next.role !== "your next role") setRoleInput(next.role);
    }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load("", false); }, []);
  function submit(event: FormEvent) { event.preventDefault(); void load(roleInput, aiOptIn); }
  if (loading) return <Loading label="Comparing your profile with available opportunities" />;
  return <>
    <AppHeader title="Suggestions grounded in your profile." eyebrow="Career recommendations">
      <p className="heading-description">Compare your skills with current listings and choose practical next steps. Recommendations are guidance, not a promise of employment.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}
    {result && <>
      <form className="form-panel recommendation-controls" onSubmit={submit}>
        <label>Role you want to explore<input value={roleInput} onChange={(event) => setRoleInput(event.target.value)} maxLength={180} placeholder="Use your profile target or try another role" /></label>
        <label className="recommendation-ai-choice"><input type="checkbox" checked={aiOptIn} disabled={!result.aiAvailable} onChange={(event) => setAiOptIn(event.target.checked)} /><span><b>Include optional AI guidance</b><small>When enabled, your chosen role, skill names, up to five experience titles and summaries, work preferences, and public job requirements are sent to the configured OpenAI service. Your resume file, name, contact details, employer names, and application history are not sent.</small></span></label>
        {!result.aiAvailable && <p className="field-hint">Optional AI is not configured on this server. Local recommendations are ready to use.</p>}
        <button className="button" disabled={loading}><Sparkles size={15} />Refresh recommendations</button>
      </form>
      <section className="recommendation-summary"><div className="recommendation-summary-mark"><Sparkles size={18} /></div><div><p className="eyebrow">{result.source === "OPTIONAL_AI" ? "Optional AI guidance" : "Local, rules-based guidance"}</p><h2>A next step for {result.role}</h2><p>{result.summary}</p></div></section>
      <p className="field-hint recommendation-privacy-note">Job order and match scores come from the local, explainable profile comparison. AI can add a short summary when you opt in; it does not rank people or predict hiring outcomes.</p>
      <section className="recommendation-results"><div className="section-title-inline"><div><p className="eyebrow">Based on published listings</p><h2>Roles to explore</h2></div></div>
        {result.opportunities.length === 0 ? <EmptyState title="No published roles yet." body="Check again when more opportunities are available, or add skills to your profile to improve future comparisons." action={<Link className="button button-secondary" to="/jobs">Browse jobs <ArrowRight size={15} /></Link>} /> : <div className="recommendation-list">{result.opportunities.map((item) => <article className="form-panel recommendation-card" key={item.id}><div className="recommendation-card-heading"><div><p className="eyebrow">{item.company}{item.isDemo && <span className="demo-badge">Demo</span>}</p><h3>{item.title}</h3><p>{item.location ?? "Location not specified"}</p></div><span className="recommendation-score">{item.match?.score === null || !item.match ? "Add profile details" : `${item.match.score}% profile match`}</span></div><div className="job-skills">{item.skills.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div>{item.match && <p className="recommendation-match-copy">{item.match.description}{item.match.missingRequiredSkills.length > 0 ? ` Required skills to explore: ${item.match.missingRequiredSkills.join(", ")}.` : " Your profile includes the listed required skills."}</p>}<Link className="arrow-link" to={`/jobs/${item.id}`}>Review the role and its match details <ArrowRight size={14} /></Link></article>)}</div>}
      </section>
    </>}
  </>;
}
