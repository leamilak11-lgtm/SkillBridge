import { useEffect, useState } from "react";
import { ArrowRight, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { Job } from "../types";
import { JobCard } from "./JobCard";
type SavedJob = { id: string; createdAt: string; job: Job };
export function SavedJobsPage() {
  const [items, setItems] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { const result = await api<{ savedJobs: SavedJob[] }>("/saved-jobs"); setItems(result.savedJobs); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function remove(jobId: string) {
    try { await api("/jobs/" + jobId + "/save", { method: "DELETE" }); setItems((current) => current.filter((item) => item.job.id !== jobId)); }
    catch (reason) { setError(errorMessage(reason)); }
  }
  return <>
    <AppHeader title="Saved opportunities" eyebrow="Keep the possibilities close">
      <p className="heading-description">Roles you want to revisit, with your current profile comparison attached.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}
    {loading ? <Loading label="Loading saved opportunities" /> : items.length
      ? <div className="job-list-grid">{items.map((item) => <JobCard key={item.id} job={item.job} saved onRemove={() => void remove(item.job.id)} />)}</div>
      : <EmptyState title="No saved roles yet." body="When an opportunity catches your eye, save it here and come back when you are ready." action={<Link className="button" to="/jobs"><Bookmark size={15} />Explore jobs <ArrowRight size={15} /></Link>} />}
  </>;
}
