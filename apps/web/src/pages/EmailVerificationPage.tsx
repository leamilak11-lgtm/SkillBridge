import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useAuth } from "../auth";
import { api, errorMessage } from "../api";
import { AuthCard, Loading, Notice } from "../components";

export function EmailVerificationPage() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
  const requestedToken = useRef("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [developmentUrl, setDevelopmentUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || requestedToken.current === token) return;
    requestedToken.current = token;
    setBusy(true);
    void api<{ message: string }>("/auth/email-verification/confirm", { method: "POST", body: { token } })
      .then((result) => setMessage(result.message))
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
  }, [token]);

  async function resend(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setDevelopmentUrl("");
    try {
      const result = await api<{ message: string; developmentVerificationUrl?: string }>("/auth/email-verification/resend", { method: "POST", body: { email } });
      setMessage(result.message);
      setDevelopmentUrl(result.developmentVerificationUrl ?? "");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <AuthCard>
    <Link to="/sign-in" className="back-link">Back to sign in</Link>
    <p className="eyebrow">Email confirmation</p>
    <h1>{token ? "Verify your email." : "Resend your link."}</h1>
    <p className="auth-description">{token ? "We’re checking your one-time verification link." : "Enter the email address you used to register. We’ll send a fresh link if that account still needs verification."}</p>
    {busy && token && <p className="verification-progress">Checking your verification link…</p>}
    {error && <Notice kind="error">{error}</Notice>}
    {message && <Notice kind="success">{message}</Notice>}
    {developmentUrl && <a className="button button-full" href={developmentUrl}>Verify email (local development) <ArrowRight size={16} /></a>}
    {message.includes("verified") && <p className="auth-switch"><Link to="/sign-in">Continue to sign in</Link></p>}
    {(!token || error) && <form className="form-stack verification-resend" onSubmit={(event) => void resend(event)}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
      <button className="button button-full" disabled={busy}>{busy ? "Please wait…" : "Send verification link"} <ArrowRight size={16} /></button>
    </form>}
  </AuthCard>;
}

function roleHome(role: "JOB_SEEKER" | "RECRUITER" | "ADMIN") {
  return role === "ADMIN" ? "/app/admin" : role === "RECRUITER" ? "/app/recruiter" : "/app/profile";
}

export function AuthCallbackPage() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const refreshed = useRef(false);
  useEffect(() => {
    if (!refreshed.current) {
      refreshed.current = true;
      void refresh();
    }
  }, []);
  useEffect(() => {
    if (loading) return;
    if (user) navigate(roleHome(user.role), { replace: true });
    else navigate("/sign-in?error=google", { replace: true });
  }, [loading, user, navigate]);
  return <AuthCard><Loading label="Finishing Google sign-in" /><p className="verification-progress"><Check size={14} />Securely finishing your sign-in…</p></AuthCard>;
}
