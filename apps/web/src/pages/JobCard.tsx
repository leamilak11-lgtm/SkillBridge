import { ArrowUpRight, Bookmark, Clock3, MapPin, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import type { Job } from "../types";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export function JobCard({ job, compact = false, saved = false, onRemove }: { job: Job; compact?: boolean; saved?: boolean; onRemove?: () => void }) {
  const score = job.match?.score;
  return <article className={"job-card" + (compact ? " job-card-compact" : "")}>
    <div className="job-card-top"><div className="company-monogram">{job.company.name.replace(/^Demo — /, "").slice(0, 1).toUpperCase()}</div><div className="job-company"><strong>{job.company.name.replace(/^Demo — /, "")}</strong><span>{job.company.location ?? job.location ?? "Location not specified"}</span></div>
      {job.isDemo && <span className="demo-badge">Demo listing</span>}</div>
    <Link className="job-title-link" to={"/jobs/" + job.id}><h3>{job.title.replace(/^Demo role: /, "")}</h3></Link>
    <div className="job-meta"><span><Wifi size={14} />{label(job.workArrangement)}</span><span><Clock3 size={14} />{label(job.employmentType)}</span>{job.location && <span><MapPin size={14} />{job.location}</span>}</div>
    {!compact && <p className="job-card-description">{job.description}</p>}
    <div className="job-skills">{job.skills.slice(0, compact ? 3 : 5).map((skill) => <span className={skill.required ? "skill-chip" : "skill-chip skill-chip-soft"} key={skill.name}>{skill.name}</span>)}</div>
    <div className="job-card-bottom">{score !== undefined && score !== null
      ? <span className="fit-badge"><span className="fit-dot" />{score}% profile fit</span>
      : <span className="unknown-fit"><span />Add profile info for a match</span>}
      <div className="job-card-actions">{onRemove && <button type="button" className="icon-button" onClick={onRemove} aria-label="Remove saved job"><Bookmark size={16} fill={saved ? "currentColor" : "none"} /></button>}<Link className="card-open-link" to={"/jobs/" + job.id}>View role <ArrowUpRight size={15} /></Link></div>
    </div>
  </article>;
}
