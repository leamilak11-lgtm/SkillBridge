import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, CirclePlus, Edit3, Goal, MinusCircle, Save, Target, Trash2 } from "lucide-react";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { Job } from "../types";

type PlanStep = {
  id: string; title: string; reason: string; action: string; evidence: string; skillName: string | null;
  completedAt: string | null; dismissedAt: string | null; custom: boolean;
};
type Goal = {
  id: string; targetRole: string; targetDate: string | null; status: string;
  plan: { id: string; steps: PlanStep[] } | null;
};
type StepFields = { title: string; reason: string; action: string; evidence: string };
function PlanStepCard({ goalId, step, changed }: { goalId: string; step: PlanStep; changed: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<StepFields>({ title: step.title, reason: step.reason, action: step.action, evidence: step.evidence });
  async function patch(data: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      await api("/goals/" + goalId + "/steps/" + step.id, { method: "PATCH", body: data });
      changed(); setEditing(false);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <article className={"plan-step" + (step.completedAt ? " plan-step-complete" : "") + (step.dismissedAt ? " plan-step-dismissed" : "")}>
    <div className="plan-step-marker">{step.completedAt ? <Check size={15} /> : <span />}</div>
    <div className="plan-step-content">
      {editing ? <form className="plan-step-edit" onSubmit={(event) => { event.preventDefault(); void patch(fields); }}>
        <label>Step title<input value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} required /></label>
        <label>Why this helps<textarea rows={2} value={fields.reason} onChange={(event) => setFields({ ...fields, reason: event.target.value })} required /></label>
        <label>Practical action<textarea rows={3} value={fields.action} onChange={(event) => setFields({ ...fields, action: event.target.value })} required /></label>
        <label>How to show progress<textarea rows={2} value={fields.evidence} onChange={(event) => setFields({ ...fields, evidence: event.target.value })} required /></label>
        {error && <Notice kind="error">{error}</Notice>}<button className="button button-small"><Save size={13} />Save edits</button>
      </form> : <>
        <div className="plan-step-heading"><div><h3>{step.title}</h3>{step.skillName && <span className="skill-chip">{step.skillName}</span>}{step.custom && <span className="custom-badge">Your idea</span>}</div><button className="icon-button" onClick={() => setEditing(true)} aria-label={"Edit " + step.title}><Edit3 size={15} /></button></div>
        <p className="plan-step-reason">{step.reason}</p><div className="plan-step-detail"><b>Try this</b><p>{step.action}</p></div><div className="plan-step-evidence"><Check size={14} /><span><b>Evidence of progress</b><small>{step.evidence}</small></span></div>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="plan-step-actions"><button className="button button-small button-secondary" disabled={busy} onClick={() => void patch({ completed: !step.completedAt })}>{step.completedAt ? "Mark as active" : "Mark complete"}</button><button className="step-dismiss-button" disabled={busy} onClick={() => void patch({ dismissed: !step.dismissedAt })}>{step.dismissedAt ? "Restore step" : <><MinusCircle size={13} />Dismiss</>}</button></div>
      </>}
    </div>
  </article>;
}

export function CareerPlanPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [targetRole, setTargetRole] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customGoalId, setCustomGoalId] = useState("");
  const [customStep, setCustomStep] = useState<StepFields>({ title: "", reason: "", action: "", evidence: "" });
  async function load() {
    setLoading(true); setError("");
    try {
      const [goalResult, jobResult] = await Promise.all([
        api<{ goals: Goal[] }>("/goals"), api<{ jobs: Job[] }>("/jobs"),
      ]);
      setGoals(goalResult.goals); setJobs(jobResult.jobs);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await api("/goals", { method: "POST", body: { targetRole, jobId: jobId || null } });
      setTargetRole(""); setJobId(""); setMessage("Your development plan is ready. Edit any step to make it your own."); await load();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function addStep(event: FormEvent, goalId: string) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/goals/" + goalId + "/steps", { method: "POST", body: customStep });
      setCustomStep({ title: "", reason: "", action: "", evidence: "" }); setCustomGoalId(""); await load();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function removeGoal(goal: Goal) {
    if (!window.confirm("Delete the plan for " + goal.targetRole + "?")) return;
    setError("");
    try {
      await api("/goals/" + goal.id, { method: "DELETE" });
      setGoals((current) => current.filter((item) => item.id !== goal.id));
      setMessage("Career plan deleted.");
    } catch (reason) { setError(errorMessage(reason)); }
  }
  if (loading) return <Loading label="Preparing your career plan" />;
  return <>
    <AppHeader title="Make your next step practical." eyebrow="A plan that moves with you">
      <p className="heading-description">Choose a target role and SkillBridge will turn relevant job requirements into small, editable actions. The plan is a local rules-based starting point, not AI-generated advice.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    <section className="goal-create-panel"><div className="goal-create-copy"><span className="goal-create-icon"><Goal size={21} /></span><div><p className="eyebrow">Start with a direction</p><h2>What role are you moving toward?</h2><p>Add a target role. Choose a job listing too if you want the first steps to reflect its requirements.</p></div></div>
      <form className="goal-create-form" onSubmit={(event) => void create(event)}><label>Target role<input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} maxLength={180} placeholder="e.g. Product designer" required /></label><label>Use a job listing<select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">No specific listing</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title.replace(/^Demo role: /, "")} — {job.company.name.replace(/^Demo — /, "")}</option>)}</select></label><button className="button" disabled={busy}>{busy ? "Building plan…" : "Create my plan"}<ArrowRight size={15} /></button></form>
    </section>
    <section className="career-goals-section"><div className="section-title-inline"><div><p className="eyebrow">Your direction</p><h2>Plans you can shape as you go</h2></div></div>
      {goals.length === 0 ? <EmptyState title="Your plan starts with a target." body="A good plan is grounded in role requirements and your own evidence. You can edit or dismiss every suggestion." action={<span className="goal-empty-icon"><Target size={17} />Use the form above to begin</span>} /> :
        <div className="career-goals-list">{goals.map((goal) => {
          const steps = goal.plan?.steps ?? [];
          const active = steps.filter((step) => !step.dismissedAt);
          const done = active.filter((step) => step.completedAt).length;
          return <article className="goal-card" key={goal.id}>
            <div className="goal-card-header"><div className="goal-icon"><Target size={19} /></div><div className="goal-card-title"><p className="eyebrow">TARGET ROLE</p><h3>{goal.targetRole}</h3></div><span className={"goal-progress-pill" + (goal.status === "COMPLETE" ? " goal-complete" : "")}>{goal.status === "COMPLETE" ? "Complete" : done + " of " + active.length + " steps"}</span><button className="icon-button icon-button-danger" onClick={() => void removeGoal(goal)} aria-label={"Delete plan for " + goal.targetRole}><Trash2 size={15} /></button></div>
            {active.length > 0 && <div className="goal-progress-track"><span style={{ width: Math.round((done / active.length) * 100) + "%" }} /></div>}
            <div className="plan-step-list">{steps.map((step) => <PlanStepCard key={step.id} goalId={goal.id} step={step} changed={() => void load()} />)}</div>
            {customGoalId === goal.id ? <form className="custom-step-form" onSubmit={(event) => void addStep(event, goal.id)}><div className="form-panel-heading"><span className="panel-icon"><CirclePlus size={17} /></span><div><h3>Add your own step</h3><p>Make it specific enough that you will know when you have done it.</p></div></div><label>Step title<input value={customStep.title} onChange={(event) => setCustomStep({ ...customStep, title: event.target.value })} required /></label><label>Why this helps<textarea rows={2} value={customStep.reason} onChange={(event) => setCustomStep({ ...customStep, reason: event.target.value })} required /></label><label>Practical action<textarea rows={2} value={customStep.action} onChange={(event) => setCustomStep({ ...customStep, action: event.target.value })} required /></label><label>How to show progress<textarea rows={2} value={customStep.evidence} onChange={(event) => setCustomStep({ ...customStep, evidence: event.target.value })} required /></label><div className="custom-step-actions"><button className="button button-small" disabled={busy}>Add step</button><button type="button" className="step-dismiss-button" onClick={() => setCustomGoalId("")}>Cancel</button></div></form> : <button className="add-plan-step" onClick={() => setCustomGoalId(goal.id)}><CirclePlus size={16} />Add a step of your own</button>}
          </article>;
        })}</div>}
    </section>
  </>;
}
