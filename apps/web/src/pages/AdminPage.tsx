import { useEffect, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, Building2, Check, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { AdminCompany, AdminJob, AdminReport, AdminUser } from "../types";

type Overview = { users: number; seekers: number; recruiters: number; companiesPending: number; jobsPending: number; publishedJobs: number; applications: number; openReports: number };
const friendly = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobStatuses, setJobStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const [overviewResult, companiesResult, jobsResult, reportsResult, usersResult] = await Promise.all([
        api<{ overview: Overview }>("/admin/overview"),
        api<{ companies: AdminCompany[] }>("/admin/companies"),
        api<{ jobs: AdminJob[] }>("/admin/jobs"),
        api<{ reports: AdminReport[] }>("/admin/reports"),
        api<{ users: AdminUser[] }>("/admin/users"),
      ]);
      setOverview(overviewResult.overview); setCompanies(companiesResult.companies);
      setJobs(jobsResult.jobs); setReports(reportsResult.reports); setUsers(usersResult.users);
      setJobStatuses(Object.fromEntries(jobsResult.jobs.map((job) => [job.id, job.status])));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function action(run: () => Promise<unknown>, successMessage: string) {
    setBusy(true); setError(""); setNotice("");
    try { await run(); await load(); setNotice(successMessage); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  if (loading) return <Loading label="Loading administration workspace" />;
  return <>
    <AppHeader title="Moderation desk" eyebrow="SkillBridge administration">
      <p>Review company requests, job reports, listings, and account actions. Every moderation change is written to the audit log.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}{notice && <Notice kind="success">{notice}</Notice>}
    <div className="admin-summary-grid">
      <article><Users size={18} /><span>Accounts</span><strong>{overview?.users ?? 0}</strong><small>{overview?.seekers ?? 0} seekers · {overview?.recruiters ?? 0} recruiters</small></article>
      <article><Building2 size={18} /><span>Company review</span><strong>{overview?.companiesPending ?? 0}</strong><small>pending approval</small></article>
      <article><AlertTriangle size={18} /><span>Open reports</span><strong>{overview?.openReports ?? 0}</strong><small>awaiting moderation</small></article>
      <article><Check size={18} /><span>Live listings</span><strong>{overview?.publishedJobs ?? 0}</strong><small>{overview?.applications ?? 0} total applications</small></article>
    </div>

    <section className="form-panel admin-panel">
      <div className="form-panel-heading"><span className="panel-icon"><Building2 size={18} /></span><div><h2>Company review</h2><p>Approve trusted companies before they can publish jobs, or suspend access when needed.</p></div><button className="icon-button" aria-label="Refresh moderation data" onClick={() => void load()}><RefreshCw size={15} /></button></div>
      {companies.length === 0 ? <EmptyState title="No company accounts yet." body="New recruiter registrations will appear here for review." /> :
        <div className="admin-record-list">{companies.map((company) => <article className="admin-record" key={company.id}>
          <div className="admin-record-main"><div><span className={`status-pill ${company.isApproved ? "status-published" : "status-draft"}`}>{company.isApproved ? "Approved" : "Pending review"}</span>{company.isSuspended && <span className="status-pill status-suspended">Suspended</span>}</div><h3>{company.name}{company.isDemo && <span className="demo-badge">Demo</span>}</h3><p>{company.location ?? "Location not supplied"}{company.website ? ` · ${company.website}` : ""}</p><small>{company.members[0]?.user.name ?? "No owner"}{company.members[0]?.user.email ? ` · ${company.members[0].user.email}` : ""} · {company._count.jobs} jobs · {company._count.reports} reports</small></div>
          <div className="admin-record-actions">
            <button className="button button-secondary button-small" disabled={busy || company.isApproved} onClick={() => void action(() => api(`/admin/companies/${company.id}`, { method: "PATCH", body: { isApproved: true } }), `${company.name} approved.`)}>Approve</button>
            {company.isApproved && <button className="button button-quiet button-small" disabled={busy} onClick={() => {
              const reason = window.prompt(`Reason for revoking approval for ${company.name}:`);
              if (reason === null) return;
              void action(() => api(`/admin/companies/${company.id}`, { method: "PATCH", body: { isApproved: false, reason } }), `${company.name} approval revoked.`);
            }}>Revoke approval</button>}
            <button className={"button button-small " + (company.isSuspended ? "button-secondary" : "button-danger")} disabled={busy} onClick={() => {
              if (company.isSuspended) {
                void action(() => api(`/admin/companies/${company.id}`, { method: "PATCH", body: { isSuspended: false } }), `${company.name} reinstated.`);
                return;
              }
              const reason = window.prompt(`Reason for suspending ${company.name}:`);
              if (reason === null) return;
              void action(() => api(`/admin/companies/${company.id}`, { method: "PATCH", body: { isSuspended: true, reason } }), `${company.name} suspended.`);
            }}>{company.isSuspended ? "Reinstate" : "Suspend"}</button>
          </div>
        </article>)}</div>}
    </section>

    <section className="form-panel admin-panel">
      <div className="form-panel-heading"><span className="panel-icon"><AlertTriangle size={18} /></span><div><h2>Job reports</h2><p>Review reports submitted by signed-in users. Resolve or dismiss each report after review.</p></div></div>
      {reports.length === 0 ? <EmptyState title="No reports in the queue." body="Reported jobs and companies will appear here." /> :
        <div className="admin-record-list">{reports.map((report) => <article className="admin-record" key={report.id}>
          <div className="admin-record-main"><span className={`status-pill status-${report.status.toLowerCase()}`}>{friendly(report.status)}</span><h3>{report.job?.title ?? report.company?.name ?? "Unavailable listing"}</h3><p>{report.job ? `Company: ${report.job.company.name}` : "Company report"}</p><blockquote>{report.reason}</blockquote><small>Reported by {report.author?.name ?? "Deleted account"} · {new Date(report.createdAt).toLocaleString()}</small></div>
          <div className="admin-record-actions">
            <button className="button button-secondary button-small" disabled={busy || report.status === "REVIEWING"} onClick={() => void action(() => api(`/admin/reports/${report.id}`, { method: "PATCH", body: { status: "REVIEWING" } }), "Report marked as under review.")}>Review</button>
            <button className="button button-small" disabled={busy || report.status === "RESOLVED"} onClick={() => void action(() => api(`/admin/reports/${report.id}`, { method: "PATCH", body: { status: "RESOLVED" } }), "Report resolved.")}>Resolve</button>
            <button className="button button-quiet button-small" disabled={busy || report.status === "DISMISSED"} onClick={() => void action(() => api(`/admin/reports/${report.id}`, { method: "PATCH", body: { status: "DISMISSED" } }), "Report dismissed.")}>Dismiss</button>
            {report.job && report.job.status === "PUBLISHED" && <button className="button button-danger button-small" disabled={busy} onClick={() => void action(() => api(`/admin/jobs/${report.job!.id}/status`, { method: "PATCH", body: { status: "SUSPENDED", reason: `Suspended after report ${report.id}.` } }), "Reported job suspended.")}>Suspend job</button>}
            {report.company && !report.company.isSuspended && <button className="button button-danger button-small" disabled={busy} onClick={() => {
              const reason = window.prompt(`Reason for suspending ${report.company!.name}:`);
              if (reason === null) return;
              void action(() => api(`/admin/companies/${report.company!.id}`, { method: "PATCH", body: { isSuspended: true, reason } }), "Reported company suspended.");
            }}>Suspend company</button>}
          </div>
        </article>)}</div>}
    </section>

    <section className="form-panel admin-panel">
      <div className="form-panel-heading"><span className="panel-icon"><BriefcaseBusiness size={18} /></span><div><h2>Job listings</h2><p>Pause or restore listings when a report or policy review requires action.</p></div></div>
      {jobs.length === 0 ? <EmptyState title="No job listings yet." body="Recruiter drafts and published listings will appear here." /> :
        <div className="admin-record-list">{jobs.map((job) => <article className="admin-record admin-job-record" key={job.id}>
          <div className="admin-record-main"><span className={`status-pill status-${job.status.toLowerCase()}`}>{friendly(job.status)}</span><h3>{job.title}</h3><p>{job.company.name} · {job.location ?? "Location not specified"}</p><small>{job._count.applications} applications · {job._count.reports} reports · updated {new Date(job.updatedAt).toLocaleDateString()}</small></div>
          <div className="admin-record-actions"><label className="admin-status-select"><span>Listing status</span><select value={jobStatuses[job.id] ?? job.status} onChange={(event) => setJobStatuses((current) => ({ ...current, [job.id]: event.target.value }))}><option value="DRAFT">Draft</option><option value="PUBLISHED" disabled={!job.company.isApproved || job.company.isSuspended}>Published</option><option value="SUSPENDED">Suspended</option><option value="CLOSED">Closed</option></select></label>
            <button className="button button-secondary button-small" disabled={busy || (jobStatuses[job.id] ?? job.status) === job.status} onClick={() => void action(() => api(`/admin/jobs/${job.id}/status`, { method: "PATCH", body: { status: jobStatuses[job.id] ?? job.status, reason: "Listing status updated during administrative review." } }), "Listing status updated.")}>Save</button></div>
        </article>)}</div>}
    </section>

    <section className="form-panel admin-panel">
      <div className="form-panel-heading"><span className="panel-icon"><ShieldCheck size={18} /></span><div><h2>Account access</h2><p>Suspend compromised or policy-violating accounts. Suspended sessions are revoked immediately.</p></div></div>
      {users.length === 0 ? <EmptyState title="No accounts found." body="Registered user accounts will appear here." /> :
        <div className="admin-record-list">{users.map((user) => <article className="admin-record" key={user.id}>
          <div className="admin-record-main"><span className="status-pill status-draft">{friendly(user.role)}</span><h3>{user.name}</h3><p>{user.email}</p><small>Joined {new Date(user.createdAt).toLocaleDateString()}</small></div>
          <div className="admin-record-actions">{user.role !== "ADMIN" && <button className={"button button-small " + (user.isSuspended ? "button-secondary" : "button-danger")} disabled={busy} onClick={() => {
            const reason = window.prompt(user.isSuspended ? "Reason for reinstating this account:" : "Reason for suspending this account:");
            if (reason === null) return;
            void action(() => api(`/admin/users/${user.id}/suspension`, { method: "PATCH", body: { suspended: !user.isSuspended, reason } }), user.isSuspended ? `${user.name} reinstated.` : `${user.name} suspended.`);
          }}>{user.isSuspended ? "Reinstate" : "Suspend account"}</button>}{user.isSuspended && <span className="status-pill status-suspended">Suspended</span>}</div>
        </article>)}</div>}
    </section>
    <div className="recruiter-approval-note"><ShieldCheck size={15} /><span>Administrator accounts are created from the command line with <code>npm --workspace @skillbridge/api run admin:create -- --email admin@example.com</code>. New public sign-ups cannot choose an administrator role.</span></div>
  </>;
}
