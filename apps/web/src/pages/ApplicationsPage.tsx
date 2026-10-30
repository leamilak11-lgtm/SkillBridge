import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, Clock3, MessageSquareText } from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";

type Application = {
  id: string; status: string; submittedAt: string; seekerNotes: string | null; coverLetter: string | null;
  resume: { id: string; originalName: string } | null;
  job: { id: string; title: string; location: string | null; workArrangement: string; employmentType: string; isDemo: boolean; company: { name: string; isDemo: boolean } };
  history: Array<{ status: string; note: string | null; createdAt: string }>;
};
const statuses = ["APPLIED", "UNDER_REVIEW", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
const titleCase = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
export function ApplicationsPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api<{ applications: Application[] }>("/applications");
      setItems(result.applications);
      setDraftNotes(Object.fromEntries(result.applications.map((item) => [item.id, item.seekerNotes ?? ""])));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function saveNotes(event: FormEvent, id: string) {
    event.preventDefault(); setBusyId(id); setError(""); setMessage("");
    try {
      const result = await api<{ application: { id: string; seekerNotes: string | null } }>("/applications/" + id, {
        method: "PATCH", body: { seekerNotes: draftNotes[id]?.trim() || null },
      });
      setItems((current) => current.map((item) => item.id === id ? { ...item, seekerNotes: result.application.seekerNotes } : item));
      setMessage("Your private note was saved.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusyId(""); }
  }
  async function withdraw(id: string) {
    if (!window.confirm("Withdraw this application?")) return;
    setBusyId(id); setError(""); setMessage("");
    try { await api("/applications/" + id + "/withdraw", { method: "POST" }); await load(); setMessage("Application withdrawn."); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusyId(""); }
  }
  return <>
    <AppHeader title="Application tracker" eyebrow="One step at a time">
      <p className="heading-description">Keep track of what you have sent, what comes next, and the notes you want to remember. Your notes are private to you.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    {loading ? <Loading label="Loading your applications" /> : items.length === 0
      ? <EmptyState title="Your applications will show up here." body="Saving a job keeps it in your list. Applying creates a separate application that you can track here." action={<Link className="button" to="/jobs">Explore jobs <ArrowRight size={15} /></Link>} />
      : <div className="application-list">{items.map((item) => <article className="application-card" key={item.id}>
        <div className="application-card-head"><div className="company-monogram">{item.job.company.name.replace(/^Demo — /, "").slice(0, 1).toUpperCase()}</div><div className="application-title"><h2><Link to={"/jobs/" + item.job.id}>{item.job.title.replace(/^Demo role: /, "")}</Link></h2><p>{item.job.company.name.replace(/^Demo — /, "")}{item.job.isDemo && <span className="demo-badge">Demo listing</span>}</p></div><span className={"status-pill status-" + item.status.toLowerCase()}>{titleCase(item.status)}</span></div>
        <div className="application-facts"><span><CalendarDays size={14} />Applied {new Date(item.submittedAt).toLocaleDateString()}</span>{item.job.location && <span>{item.job.location}</span>}{item.resume && <span><BriefcaseBusiness size={14} />{item.resume.originalName}</span>}</div>
        <div className="application-history"><p className="eyebrow">Status history</p><div className="history-track">{item.history.map((event, index) => <div className="history-event" key={event.createdAt + event.status}><span className={"history-dot" + (index === item.history.length - 1 ? " history-current" : "")}>{index === item.history.length - 1 && <Check size={10} />}</span><span><b>{titleCase(event.status)}</b><small>{new Date(event.createdAt).toLocaleDateString()}</small></span></div>)}</div></div>
        <form className="application-note" onSubmit={(event) => void saveNotes(event, item.id)}><label><span><MessageSquareText size={14} />Private note</span><textarea rows={2} maxLength={4000} value={draftNotes[item.id] ?? ""} onChange={(event) => setDraftNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="A reminder for yourself about this role or your follow-up." /></label><div className="application-note-actions"><span>Your note is not shared with the employer.</span><button className="button button-small button-secondary" disabled={busyId === item.id}>{busyId === item.id ? "Saving…" : "Save note"}</button></div></form>
        {item.status !== "WITHDRAWN" && item.status !== "REJECTED" && <button className="withdraw-button" disabled={busyId === item.id} onClick={() => void withdraw(item.id)}><Clock3 size={13} />Withdraw application</button>}
      </article>)}</div>}
  </>;
}
