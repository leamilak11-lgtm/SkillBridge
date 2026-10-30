import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, CircleHelp, Shield, UserRound } from "lucide-react";
import { useAuth } from "../auth";
import { api, errorMessage } from "../api";
import { AppHeader, EmptyState, Loading, Notice } from "../components";
import type { Profile } from "../types";

type Completion = { percent: number; sections: Array<{ key: string; label: string; complete: boolean }> };
type ProfileResult = { profile: Profile; completion: Completion };
const joinLines = (lines: string[]) => lines.join("\n");
const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const dateValue = (value: string | null) => value ? value.slice(0, 7) : "";
const dateIso = (value: string) => value ? new Date(value + "-01T00:00:00.000Z").toISOString() : "";
const cleanLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
function skillLevel(value?: string) {
  const normalized = (value ?? "").toUpperCase();
  return ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"].includes(normalized) ? normalized : undefined;
}

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(Date.now());
  const avatarInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [headline, setHeadline] = useState("");
  const [location, setLocation] = useState("");
  const [biography, setBiography] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [experienceText, setExperienceText] = useState("");
  const [educationText, setEducationText] = useState("");
  const [projectsText, setProjectsText] = useState("");
  const [certificationText, setCertificationText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [desiredRoles, setDesiredRoles] = useState("");
  const [desiredIndustries, setDesiredIndustries] = useState("");
  const [preferredLocations, setPreferredLocations] = useState("");
  const [arrangements, setArrangements] = useState<string[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [currency, setCurrency] = useState("");
  const [visibility, setVisibility] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function loadProfile() {
    setLoading(true);
    try {
      const result = await api<ProfileResult>("/profile");
      const value = result.profile;
      setProfile(value); setCompletion(result.completion);
      setName(user?.name ?? "");
      setHeadline(value.headline ?? ""); setLocation(value.location ?? ""); setBiography(value.biography ?? "");
      setSkillsText(joinLines(value.skills.map((item) => [item.skill.name, item.level ?? "", item.yearsExperience ?? "", item.evidence ?? ""].join(" | "))));
      setExperienceText(joinLines(value.experiences.map((item) => [item.title, item.company, item.description, dateValue(item.startDate), item.isCurrent ? "current" : dateValue(item.endDate)].join(" | "))));
      setEducationText(joinLines(value.education.map((item) => [item.qualification ?? "", item.institution, item.field ?? ""].join(" | "))));
      setProjectsText(joinLines(value.projects.map((item) => [item.name, item.description, item.url ?? ""].join(" | "))));
      setCertificationText(joinLines(value.certifications.map((item) => [item.name, item.issuer, item.credentialUrl ?? ""].join(" | "))));
      setLanguagesText(joinLines(value.languages.map((item) => [item.name, item.proficiency ?? ""].join(" | "))));
      setDesiredRoles(value.desiredRoles.join(", ")); setDesiredIndustries(value.desiredIndustries.join(", "));
      setPreferredLocations(value.preferredLocations.join(", ")); setArrangements(value.workArrangements);
      setEmploymentTypes(value.employmentTypes); setSalaryMin(value.salaryMin?.toString() ?? "");
      setSalaryMax(value.salaryMax?.toString() ?? ""); setCurrency(value.salaryCurrency ?? "");
      setVisibility(value.visibilityPublic);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadProfile(); }, [user?.id]);
  function toggleArray(values: string[], setValues: (next: string[]) => void, value: string) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const sections = (value: string, count: number) => cleanLines(value).map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return Array.from({ length: count }, (_, index) => parts[index] ?? "");
    });
    const skills = sections(skillsText, 4).map(([skillName = "", level = "", years = "", evidence = ""]) => {
      return {
        name: skillName,
        ...(skillLevel(level) ? { level: skillLevel(level) } : {}),
        yearsExperience: years ? Number(years) : null,
        evidence: evidence || null,
      };
    }).filter((item) => item.name);
    const experiences = sections(experienceText, 5).map(([title = "", company = "", description = "", start = "", end = ""]) => ({
      title, company, description, startDate: dateIso(start),
      endDate: end.toLowerCase() === "current" ? "" : dateIso(end),
      isCurrent: end.toLowerCase() === "current",
    })).filter((item) => item.title && item.company && item.description);
    const education = sections(educationText, 3).map(([qualification = "", institution = "", field = ""]) => ({
      qualification: qualification || null, institution, field: field || null,
    })).filter((item) => item.institution);
    const projects = sections(projectsText, 3).map(([projectName = "", description = "", url = ""]) => ({
      name: projectName, description, url: url || null,
    })).filter((item) => item.name && item.description);
    const certifications = sections(certificationText, 3).map(([certName = "", issuer = "", credentialUrl = ""]) => ({
      name: certName, issuer, credentialUrl: credentialUrl || null,
    })).filter((item) => item.name && item.issuer);
    const languages = sections(languagesText, 2).map(([language = "", proficiency = ""]) => ({
      name: language, proficiency: proficiency || null,
    })).filter((item) => item.name);
    try {
      const result = await api<ProfileResult>("/profile", { method: "PUT", body: {
        name, headline, location, biography,
        desiredRoles: splitList(desiredRoles), desiredIndustries: splitList(desiredIndustries),
        preferredLocations: splitList(preferredLocations), workArrangements: arrangements,
        employmentTypes, salaryMin: salaryMin ? Number(salaryMin) : null, salaryMax: salaryMax ? Number(salaryMax) : null,
        salaryCurrency: currency.trim() ? currency.trim().toUpperCase() : null,
        skills, experiences, education, projects, certifications, languages,
      } });
      setProfile(result.profile); setCompletion(result.completion); setMessage("Your profile is saved.");
      await refresh();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }
  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setMessage("");
    if (file.size > 2 * 1024 * 1024) {
      setError("Choose an image smaller than 2 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    const body = new FormData();
    body.append("avatar", file);
    setAvatarBusy(true);
    try {
      await api("/profile/avatar", { method: "POST", body });
      setProfile((current) => current ? { ...current, avatarUrl: "/api/profile/avatar" } : current);
      setAvatarVersion(Date.now());
      setMessage("Profile photo updated.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setAvatarBusy(false); }
  }
  async function removeAvatar() {
    setAvatarBusy(true); setError(""); setMessage("");
    try {
      await api("/profile/avatar", { method: "DELETE" });
      setProfile((current) => current ? { ...current, avatarUrl: null } : current);
      setAvatarVersion(Date.now());
      setMessage("Profile photo removed.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setAvatarBusy(false); }
  }
  async function updateVisibility(next: boolean) {
    setVisibility(next); setError(""); setMessage("");
    try {
      await api("/profile/privacy", { method: "PATCH", body: { visibilityPublic: next } });
      setMessage(next ? "Profile discovery is on. Approved recruiters can now find the profile details listed below." : "Your profile is private and no longer appears in recruiter discovery.");
    } catch (reason) { setVisibility(!next); setError(errorMessage(reason)); }
  }
  async function deleteAccount() {
    if (!deletePassword) return;
    setDeleting(true); setError("");
    try {
      await api("/profile/account", { method: "DELETE", body: { password: deletePassword } });
      await refresh(); navigate("/");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setDeleting(false); }
  }
  if (loading) return <Loading label="Loading your profile" />;
  if (!profile) return <>{error && <Notice kind="error">{error}</Notice>}<EmptyState title="Your profile is not ready." body="Try reloading this page, or sign in again." action={<button className="button" onClick={() => void loadProfile()}>Reload</button>} /></>;
  const arrangementOptions = [["ONSITE", "On-site"], ["HYBRID", "Hybrid"], ["REMOTE", "Remote"]] as const;
  const employmentOptions = [["FULL_TIME", "Full time"], ["PART_TIME", "Part time"], ["CONTRACT", "Contract"], ["INTERNSHIP", "Internship"], ["TEMPORARY", "Temporary"]] as const;
  return <>
    <AppHeader title="Your career profile" eyebrow="The starting point">
      <p className="heading-description">Your experience, skills, and preferences make your opportunity matches more useful. Add what you know; you can fill in the rest later.</p>
    </AppHeader>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    {completion && <section className="completion-card">
      <div className="completion-score"><strong>{completion.percent}%</strong><span>complete</span></div>
      <div className="completion-content"><div className="completion-title"><div><p className="eyebrow">Profile progress</p><h2>A clearer profile makes for clearer matches.</h2></div><a className="completion-link" href="#profile-basics">Keep going <ArrowRight size={14} /></a></div>
        <div className="completion-track"><span style={{ width: completion.percent + "%" }} /></div>
        <div className="completion-checks">{completion.sections.map((section) => <span className={section.complete ? "complete" : ""} key={section.key}>{section.complete ? <Check size={12} /> : <CircleHelp size={12} />}{section.label}</span>)}</div>
      </div>
    </section>}
    <form className="profile-form" onSubmit={(event) => void save(event)}>
      <section className="form-panel" id="profile-basics"><div className="form-panel-heading"><span className="panel-icon"><UserRound size={18} /></span><div><h2>About you</h2><p>Introduce yourself in a way that feels accurate.</p></div></div>
        <div className="profile-photo-row"><div className="profile-photo-preview">{profile.avatarUrl ? <img src={`${profile.avatarUrl}?v=${avatarVersion}`} alt="Your profile" /> : <span>{user?.name.slice(0, 1).toUpperCase() ?? <UserRound size={28} />}</span>}</div><div className="profile-photo-controls"><b>Profile photo</b><small>PNG, JPEG, or WebP · up to 2 MB · visible only to you</small><div className="profile-photo-actions"><input ref={avatarInput} style={{ display: "none" }} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadAvatar(event)} /><button type="button" className="button button-small" disabled={avatarBusy} onClick={() => avatarInput.current?.click()}>{avatarBusy ? "Uploading…" : profile.avatarUrl ? "Change photo" : "Upload photo"}</button>{profile.avatarUrl && <button type="button" className="text-button" disabled={avatarBusy} onClick={() => void removeAvatar()}>Remove</button>}</div></div></div>
        <div className="form-grid"><label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Professional headline<input maxLength={180} value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="e.g. Product designer focused on public services" /></label><label>Location<input autoComplete="address-level2" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Addis Ababa, Ethiopia" /></label><label className="field-full">Short biography<textarea rows={4} maxLength={3000} value={biography} onChange={(event) => setBiography(event.target.value)} placeholder="A few sentences about the work you do, what you enjoy, or what you are working toward." /></label></div>
      </section>
      <section className="form-panel"><div className="form-panel-heading"><span className="panel-icon"><Check size={18} /></span><div><h2>Skills and evidence</h2><p>One per line: skill | level | years | evidence. Levels: beginner, intermediate, advanced, expert.</p></div></div>
        {profile.skills.length > 0 && <div className="source-legend">{profile.skills.map((item) => <span key={item.id}><b>{item.skill.name}</b><small className={"source-pill source-" + item.source.toLowerCase()}>{item.source === "USER_CONFIRMED" ? "Confirmed from resume" : "Entered by you"}</small></span>)}</div>}
        <label>Skills<textarea rows={5} value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder={"Research | Advanced | 3 | Led interviews for a service redesign\nFigma | Intermediate | 2 | Built interactive prototypes"} /></label>
        <p className="field-hint">Resume ideas are never added automatically. Confirmed skills keep their review label when you save.</p>
      </section>
      <section className="form-panel"><div className="form-panel-heading"><span className="panel-icon"><UserRound size={18} /></span><div><h2>Experience</h2><p>One per line: role | company | what you did | start (YYYY-MM) | end (YYYY-MM or current).</p></div></div><label>Work experience<textarea rows={5} value={experienceText} onChange={(event) => setExperienceText(event.target.value)} placeholder={"Product Designer | Cedar Studio | Led usability studies and improved onboarding | 2022-01 | current"} /></label></section>
      <section className="form-panel"><div className="form-panel-heading"><span className="panel-icon"><Check size={18} /></span><div><h2>Education and projects</h2><p>Give people a useful example of your learning and work.</p></div></div>
        <div className="form-grid"><label>Education, one per line: qualification | institution | field<textarea rows={3} value={educationText} onChange={(event) => setEducationText(event.target.value)} placeholder="BA | Addis Ababa University | Design" /></label><label>Projects, one per line: name | description | link<textarea rows={3} value={projectsText} onChange={(event) => setProjectsText(event.target.value)} placeholder="Community map | Designed a local resource map | https://example.org" /></label><label>Certifications, one per line: name | issuer | link<textarea rows={3} value={certificationText} onChange={(event) => setCertificationText(event.target.value)} placeholder="UX foundations | Example Academy | https://example.org" /></label><label>Languages, one per line: language | proficiency<textarea rows={3} value={languagesText} onChange={(event) => setLanguagesText(event.target.value)} placeholder={"Amharic | Fluent\nEnglish | Fluent"} /></label></div>
      </section>
      <section className="form-panel"><div className="form-panel-heading"><span className="panel-icon"><ArrowRight size={18} /></span><div><h2>What you are looking for</h2><p>These preferences help explain role fit. You can leave any section blank.</p></div></div>
        <div className="form-grid"><label>Target roles, comma-separated<input value={desiredRoles} onChange={(event) => setDesiredRoles(event.target.value)} placeholder="e.g. Product designer, UX researcher" /></label><label>Industries, comma-separated<input value={desiredIndustries} onChange={(event) => setDesiredIndustries(event.target.value)} placeholder="e.g. Design, Education, Public services" /></label><label>Preferred locations, comma-separated<input value={preferredLocations} onChange={(event) => setPreferredLocations(event.target.value)} placeholder="e.g. Addis Ababa, Ethiopia" /></label>
          <fieldset className="field-choice"><legend>Work arrangement</legend><div className="choice-row">{arrangementOptions.map(([value, label]) => <label className="choice-chip" key={value}><input type="checkbox" checked={arrangements.includes(value)} onChange={() => toggleArray(arrangements, setArrangements, value)} />{label}</label>)}</div></fieldset>
          <fieldset className="field-choice"><legend>Employment type</legend><div className="choice-row">{employmentOptions.map(([value, label]) => <label className="choice-chip" key={value}><input type="checkbox" checked={employmentTypes.includes(value)} onChange={() => toggleArray(employmentTypes, setEmploymentTypes, value)} />{label}</label>)}</div></fieldset>
          <div className="salary-fields"><label>Minimum salary<input type="number" min="0" value={salaryMin} onChange={(event) => setSalaryMin(event.target.value)} placeholder="Optional" /></label><label>Maximum salary<input type="number" min="0" value={salaryMax} onChange={(event) => setSalaryMax(event.target.value)} placeholder="Optional" /></label><label>Currency<input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="ETB" /></label></div>
        </div>
      </section>
      <section className="form-panel privacy-panel"><div className="form-panel-heading"><span className="panel-icon"><Shield size={18} /></span><div><h2>Privacy and control</h2><p>Your profile is private by default. Discovery is available only to approved recruiters after you opt in.</p></div></div>
        <label className="toggle-row"><span><b>Allow recruiter discovery</b><small>When on, approved recruiters can see your name, headline, location, biography, target roles, skills, and work history. Your email, resume files, applications, and private notes stay hidden. Turn this off any time.</small></span><input type="checkbox" checked={visibility} onChange={(event) => void updateVisibility(event.target.checked)} aria-label="Allow recruiter discovery" /></label>
        <div className="privacy-divider" /><div className="danger-zone"><div><h3>Delete your account</h3><p>This permanently deletes your profile, applications, and private resume files.</p></div><div className="delete-form"><input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Confirm your password" aria-label="Confirm your password to delete the account" /><button type="button" className="button button-danger" disabled={deleting || !deletePassword} onClick={() => void deleteAccount()}>{deleting ? "Deleting…" : "Delete account"}</button></div></div>
      </section>
      <div className="profile-save-row"><span><Shield size={14} />Your profile stays private unless you choose otherwise.</span><button className="button" disabled={saving}>{saving ? "Saving…" : "Save profile"}<Check size={16} /></button></div>
    </form>
  </>;
}
