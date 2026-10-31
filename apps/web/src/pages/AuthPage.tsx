import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useAuth } from "../auth";
import { api, errorMessage } from "../api";
import { AuthCard, Notice } from "../components";
import type { User } from "../types";

export function AuthPage({ mode }: { mode: "sign-in" | "sign-up" | "recruiter-sign-up" }) {
  const { signIn, register, registerRecruiter } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [error, setError] = useState(searchParams.get("error") === "google" ? "Google sign-in could not be completed. Please try again." : "");
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ googleEnabled: boolean }>("/auth/providers").then((result) => {
      if (active) setGoogleEnabled(result.googleEnabled);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [mode]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const createdUser = await register(name, username, email, phone, password);
        navigate(createdUser.role === "ADMIN" ? "/app/admin" : createdUser.role === "RECRUITER" ? "/app/recruiter" : "/app/profile");
        return;
      }
      if (mode === "recruiter-sign-up") {
        const createdUser = await registerRecruiter({
          name, username, email, phone, password, companyName,
          ...(companyDescription.trim() ? { companyDescription: companyDescription.trim() } : {}),
          ...(companyWebsite.trim() ? { companyWebsite: companyWebsite.trim() } : {}),
          ...(companyLocation.trim() ? { companyLocation: companyLocation.trim() } : {}),
        });
        navigate(createdUser.role === "ADMIN" ? "/app/admin" : createdUser.role === "RECRUITER" ? "/app/recruiter" : "/app/profile");
        return;
      }
      const signedInUser: User = await signIn(email, password);
      const nextRole = signedInUser.role;
      navigate(nextRole === "ADMIN" ? "/app/admin" : nextRole === "RECRUITER" ? "/app/recruiter" : "/app/profile");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  const signingUp = mode !== "sign-in";
  const recruiterSignUp = mode === "recruiter-sign-up";
  const googleParams = new URLSearchParams({ role: recruiterSignUp ? "RECRUITER" : "JOB_SEEKER" });
  if (recruiterSignUp) {
    googleParams.set("companyName", companyName.trim());
    if (companyWebsite.trim()) googleParams.set("companyWebsite", companyWebsite.trim());
    if (companyLocation.trim()) googleParams.set("companyLocation", companyLocation.trim());
    if (companyDescription.trim()) googleParams.set("companyDescription", companyDescription.trim().slice(0, 500));
  }
  return <AuthCard>
    <Link to="/" className="back-link"><ArrowLeft size={16} />Back to home</Link>
    <p className="eyebrow">{recruiterSignUp ? "For employers" : signingUp ? "A thoughtful next step" : "Welcome back"}</p>
    <h1>{recruiterSignUp ? "Bring your team aboard." : signingUp ? "Build your bridge." : "Good to see you."}</h1>
    <p className="auth-description">{recruiterSignUp ? "Create a company workspace. An administrator will review it before your jobs can go live." : signingUp ? "Create your free profile and make your next move more intentional." : "Pick up where you left off on your career journey."}</p>
    {error && <Notice kind="error">{error}</Notice>}
    <>
    <form className="form-stack" onSubmit={(event) => void submit(event)}>
      {signingUp && <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required /></label>}
      {recruiterSignUp && <>
        <label>Company name<input autoComplete="organization" value={companyName} onChange={(event) => setCompanyName(event.target.value)} minLength={2} maxLength={180} required /></label>
        <label>Company website <span className="optional-label">Optional</span><input type="url" autoComplete="url" value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} maxLength={500} placeholder="https://example.com" /></label>
        <label>Company location <span className="optional-label">Optional</span><input autoComplete="address-level2" value={companyLocation} onChange={(event) => setCompanyLocation(event.target.value)} maxLength={180} placeholder="City, region" /></label>
        <label>About your company <span className="optional-label">Optional</span><textarea rows={3} value={companyDescription} onChange={(event) => setCompanyDescription(event.target.value)} maxLength={3000} /></label>
      </>}
      {signingUp && <label>Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={40} pattern="[A-Za-z0-9_.-]+" required /><small>Use 3–40 letters, numbers, dots, underscores, or hyphens.</small></label>}
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
      {signingUp && <label>Phone number<input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} minLength={7} maxLength={32} pattern="\+?[0-9 ()-]+" placeholder="+251 9xx xxx xxx" required /><small>Include your country code, for example +251.</small></label>}
      <label>Password<input type="password" autoComplete={signingUp ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} required /><small>Use at least 10 characters.</small></label>
      {!signingUp && <div className="form-inline-link"><Link to="/password-reset">Forgot password?</Link></div>}
      <button className="button button-full" disabled={busy}>{busy ? "Please wait…" : signingUp ? "Create account" : "Sign in"} <ArrowRight size={16} /></button>
    </form>
    {googleEnabled && <><div className="form-divider auth-divider"><span>or</span></div><a className="button button-secondary button-full auth-google" href={`/api/auth/google?${googleParams.toString()}`} onClick={(event) => {
      if (recruiterSignUp && companyName.trim().length < 2) {
        event.preventDefault(); setError("Enter your company name to create a recruiter account with Google.");
      }
    }}><span aria-hidden="true">G</span>{recruiterSignUp ? "Sign up as a recruiter with Google" : "Continue with Google"}</a></>}
    <p className="auth-switch">{signingUp ? "Already have an account?" : "New to SkillBridge?"} <Link to={signingUp ? "/sign-in" : "/sign-up"}>{signingUp ? "Sign in" : "Create an account"}</Link></p>
    {!signingUp && <p className="auth-switch">Hiring for a team? <Link to="/recruiter/sign-up">Create a recruiter account</Link></p>}
    {signingUp && <p className="auth-privacy"><Check size={14} />{recruiterSignUp ? "Your company stays private until it is approved." : "Your information stays yours. No public profile until you choose it."}</p>}
    </>
  </AuthCard>;
}

export function PasswordResetPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function reset(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<{ message: string }>("/auth/password-reset/request", { method: "POST", body: { username, email, phone, newPassword: password } });
      setMessage(result.message);
      setUsername(""); setEmail(""); setPhone(""); setPassword("");
      window.setTimeout(() => navigate("/sign-in"), 1200);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <AuthCard>
    <Link to="/sign-in" className="back-link"><ArrowLeft size={16} />Back to sign in</Link>
    <p className="eyebrow">Account recovery</p><h1>Reset your password.</h1>
    <p className="auth-description">Enter the username, email, and phone number on your account, then choose a new password. No verification code or email is sent.</p>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    <form className="form-stack" onSubmit={(event) => void reset(event)}>
      <label>Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={40} required /></label>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Phone number<input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} minLength={7} maxLength={32} required /></label>
      <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} required /><small>Use at least 10 characters.</small></label>
      <button className="button button-full" disabled={busy}>{busy ? "Please wait…" : "Set new password"} <ArrowRight size={16} /></button>
    </form>
  </AuthCard>;
}
