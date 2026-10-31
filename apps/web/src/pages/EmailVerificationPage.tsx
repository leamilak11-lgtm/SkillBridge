import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useAuth } from "../auth";
import { AuthCard, Loading, Notice } from "../components";

export function EmailVerificationPage() {
  return <AuthCard>
    <Link to="/sign-in" className="back-link">Back to sign in</Link>
    <p className="eyebrow">Email confirmation</p>
    <h1>Email verification is off.</h1>
    <p className="auth-description">SkillBridge accounts can sign in with the email address and password used to register. No verification email is required.</p>
    <Notice kind="success">You can continue to sign in now.</Notice>
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
