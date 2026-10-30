import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowRight, Bell, BriefcaseBusiness, Compass, FileText, Goal, Instagram, Lightbulb, Linkedin, LogOut, Menu, Search, Send, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./auth";

export function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" className={"brand" + (light ? " brand-light" : "")} aria-label="SkillBridge home">
    <span className="brand-mark"><span /></span>
    <span className="brand-name">skillbridge<span className="brand-period">.</span></span>
  </Link>;
}

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return <header className="site-header">
    <div className="header-inner">
      <Brand />
      <button className="mobile-menu-button" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen} aria-label={mobileOpen ? "Close navigation" : "Open navigation"}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav className={"main-nav" + (mobileOpen ? " mobile-open" : "")} aria-label="Main navigation">
        <NavLink to="/jobs" onClick={() => setMobileOpen(false)}>Explore jobs</NavLink>
        <a href="/#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a>
        {!user && <NavLink to="/recruiter/sign-up" onClick={() => setMobileOpen(false)}>For employers</NavLink>}
        {user ? <div className="account-menu">
          <button className="account-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span>{user.name.split(" ")[0]}</span>
          </button>
          {open && <div className="account-popover">
            {user.role === "JOB_SEEKER" && <>
              <Link to="/app/profile" onClick={() => setOpen(false)}><UserRound size={16} />My profile</Link>
              <Link to="/app/applications" onClick={() => setOpen(false)}><BriefcaseBusiness size={16} />Applications</Link>
            </>}
            {user.role === "RECRUITER" && <Link to="/app/recruiter" onClick={() => setOpen(false)}><BriefcaseBusiness size={16} />Recruiter workspace</Link>}
            {user.role === "ADMIN" && <Link to="/app/admin" onClick={() => setOpen(false)}><ShieldCheck size={16} />Administration</Link>}
            <button onClick={() => void signOut()}><LogOut size={16} />Sign out</button>
          </div>}
        </div> : <div className="nav-actions">
          <Link className="nav-signin" to="/sign-in">Sign in</Link>
          <Link className="button button-small" to="/sign-up">Get started <ArrowRight size={15} /></Link>
        </div>}
      </nav>
    </div>
  </header>;
}

export function AppHeader({ title, eyebrow, children }: { title: string; eyebrow: string; children?: ReactNode }) {
  return <div className="page-heading">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</div>
  </div>;
}

export function AppNav() {
  const { user } = useAuth();
  if (user?.role === "RECRUITER") return <nav className="app-nav" aria-label="Recruiter workspace">
    <NavLink to="/app/recruiter"><BriefcaseBusiness size={17} />Company and jobs</NavLink>
    <NavLink to="/app/recruiter/applications"><UserRound size={17} />Applications</NavLink>
    <NavLink to="/app/recruiter/candidates"><Search size={17} />Candidates</NavLink>
    <NavLink to="/app/notifications"><Bell size={17} />Notifications</NavLink>
  </nav>;
  if (user?.role === "ADMIN") return <nav className="app-nav" aria-label="Administration">
    <NavLink to="/app/admin"><ShieldCheck size={17} />Moderation desk</NavLink>
    <NavLink to="/app/notifications"><Bell size={17} />Notifications</NavLink>
  </nav>;
  return <nav className="app-nav" aria-label="Your workspace">
    <NavLink to="/app/profile"><UserRound size={17} />Profile</NavLink>
    <NavLink to="/app/resumes"><FileText size={17} />Resume</NavLink>
    <NavLink to="/app/saved"><Compass size={17} />Saved jobs</NavLink>
    <NavLink to="/app/applications"><BriefcaseBusiness size={17} />Applications</NavLink>
    <NavLink to="/app/career-plan"><Goal size={17} />Career plan</NavLink>
    <NavLink to="/app/interview-prep"><Lightbulb size={17} />Interview practice</NavLink>
    <NavLink to="/app/recommendations"><Sparkles size={17} />Recommendations</NavLink>
    <NavLink to="/app/notifications"><Bell size={17} />Notifications</NavLink>
  </nav>;
}

export function AppFrame({ children }: { children: ReactNode }) {
  return <><SiteHeader /><main className="app-wrap"><AppNav /><div className="app-content">{children}</div></main><Footer /></>;
}

export function Notice({ kind = "info", children }: { kind?: "info" | "success" | "error"; children: ReactNode }) {
  return <div className={"notice notice-" + kind} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" />{label}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Compass size={22} /></span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function Footer() {
  const socialLinks = [
    { label: "LinkedIn", href: socialUrl(import.meta.env.VITE_SOCIAL_LINKEDIN_URL, ["linkedin.com"]), icon: Linkedin },
    { label: "Instagram", href: socialUrl(import.meta.env.VITE_SOCIAL_INSTAGRAM_URL, ["instagram.com"]), icon: Instagram },
    { label: "Telegram", href: socialUrl(import.meta.env.VITE_SOCIAL_TELEGRAM_URL, ["t.me", "telegram.org"]), icon: Send },
  ].filter((item): item is typeof item & { href: string } => Boolean(item.href));
  return <footer className="site-footer"><div className="footer-inner">
    <div className="footer-brand"><Brand /><span>Career opportunities across Ethiopia.</span></div>
    <a className="footer-how-link" href="/#how-it-works">How SkillBridge works</a>
    {socialLinks.length > 0 && <nav className="footer-socials" aria-label="SkillBridge social media">{socialLinks.map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}><Icon size={17} /></a>)}</nav>}
    <span className="footer-country">Ethiopia</span>
  </div></footer>;
}

export function AuthCard({ children }: { children: ReactNode }) {
  return <><SiteHeader /><main className="auth-page"><div className="auth-decoration"><div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" /><p>Build a career<br /><em>that moves with you.</em></p><span>Clearer steps. Stronger evidence. Better direction.</span></div><section className="auth-card">{children}</section></main><Footer /></>;
}

function socialUrl(value: string | undefined, allowedHosts: string[]) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith("." + host)) ? url.href : null;
  } catch { return null; }
}
