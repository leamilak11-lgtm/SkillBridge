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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [error, setError] = useState(searchParams.get("error") === "google" ? "Google sign-in could not be completed. Please try again." : "");
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<{ message: string; developmentVerificationUrl?: string } | null>(null);
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
        setRegistration(await register(name, email, password));
        setPassword("");
        return;
      }
      if (mode === "recruiter-sign-up") {
        setRegistration(await registerRecruiter({
          name, email, password, companyName,
          ...(companyDescription.trim() ? { companyDescription: companyDescription.trim() } : {}),
          ...(companyWebsite.trim() ? { companyWebsite: companyWebsite.trim() } : {}),
          ...(companyLocation.trim() ? { companyLocation: companyLocation.trim() } : {}),
        }));
        setPassword("");
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
    {registration ? <div className="registration-confirmation">
      <Notice kind="success">{registration.message}</Notice>
      {registration.developmentVerificationUrl && <a className="button button-full" href={registration.developmentVerificationUrl}>Verify email (local development) <ArrowRight size={16} /></a>}
      <p className="auth-switch">After verification, <Link to="/sign-in">sign in</Link> to continue.</p>
      <p className="auth-switch">Didn’t receive an email? <Link to="/verify-email">Request another verification link</Link></p>
    </div> : <>
    <form className="form-stack" onSubmit={(event) => void submit(event)}>
      {signingUp && <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required /></label>}
      {recruiterSignUp && <>
        <label>Company name<input autoComplete="organization" value={companyName} onChange={(event) => setCompanyName(event.target.value)} minLength={2} maxLength={180} required /></label>
        <label>Company website <span className="optional-label">Optional</span><input type="url" autoComplete="url" value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} maxLength={500} placeholder="https://example.com" /></label>
        <label>Company location <span className="optional-label">Optional</span><input autoComplete="address-level2" value={companyLocation} onChange={(event) => setCompanyLocation(event.target.value)} maxLength={180} placeholder="City, region" /></label>
        <label>About your company <span className="optional-label">Optional</span><textarea rows={3} value={companyDescription} onChange={(event) => setCompanyDescription(event.target.value)} maxLength={3000} /></label>
      </>}
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
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
    {!signingUp && <><p className="auth-switch">Didn’t verify your email? <Link to="/verify-email">Resend verification</Link></p><p className="auth-switch">Hiring for a team? <Link to="/recruiter/sign-up">Create a recruiter account</Link></p></>}
    {signingUp && <p className="auth-switch">Already registered? <Link to="/verify-email">Resend verification</Link></p>}
    {signingUp && <p className="auth-privacy"><Check size={14} />{recruiterSignUp ? "Your company stays private until it is approved." : "Your information stays yours. No public profile until you choose it."}</p>}
    </>}
  </AuthCard>;
}

export function PasswordResetPage() {
  const initialToken = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function request(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<{ message: string; developmentToken?: string }>("/auth/password-reset/request", { method: "POST", body: { email } });
      setMessage(result.developmentToken
        ? result.message + " Local development token: " + result.developmentToken
        : result.message);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function complete(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<{ message: string }>("/auth/password-reset/complete", { method: "POST", body: { token, password } });
      setMessage(result.message);
      setToken("");
      setPassword("");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <AuthCard>
    <Link to="/sign-in" className="back-link"><ArrowLeft size={16} />Back to sign in</Link>
    <p className="eyebrow">Account recovery</p><h1>Reset your password.</h1>
    <p className="auth-description">Request a one-time password reset link. In local development without email configured, the token is shown here.</p>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    <form className="form-stack" onSubmit={(event) => void request(event)}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <button className="button button-full" disabled={busy}>Request reset token <ArrowRight size={16} /></button>
    </form>
    <div className="form-divider" />
    <form className="form-stack" onSubmit={(event) => void complete(event)}>
      <label>One-time token<input value={token} onChange={(event) => setToken(event.target.value)} minLength={20} required /></label>
      <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} required /></label>
      <button className="button button-secondary button-full" disabled={busy}>Set new password</button>
    </form>
  </AuthCard>;
}
