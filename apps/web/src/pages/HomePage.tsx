import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, Check, ChevronRight, Compass, FileCheck2, Fingerprint, MoveUpRight, ScanSearch, Sparkles, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Footer, SiteHeader } from "../components";
import type { Job } from "../types";
import { JobCard } from "./JobCard";

const loop = [
  { number: "01", title: "Bring your story", text: "Add your skills and experience. Upload a resume if you like; review every suggestion before it touches your profile.", icon: FileCheck2 },
  { number: "02", title: "See the evidence", text: "Compare your profile with real job requirements. Understand what fits, what is missing, and what is still unknown.", icon: ScanSearch },
  { number: "03", title: "Choose your next step", text: "Turn a skill gap or career goal into practical actions you can edit, complete, and show as evidence.", icon: Target },
];
export function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => { void api<{ jobs: Job[] }>("/jobs").then((result) => setJobs(result.jobs.slice(0, 2))).catch(() => undefined); }, []);
  return <>
    <SiteHeader />
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="status-dot" />CAREER CLARITY, BUILT AROUND YOU</div>
            <h1>Find your next move.<br /><em>Make it yours.</em></h1>
            <p className="hero-lede">Understand how your experience connects to the roles you want — and get a clearer path to what comes next.</p>
            <div className="hero-actions"><Link className="button" to="/sign-up">Create your profile <ArrowRight size={17} /></Link><Link className="text-link" to="/jobs">Explore open roles <MoveUpRight size={16} /></Link></div>
            <div className="hero-proof"><span><Check size={14} />Evidence-led matches</span><span><Check size={14} />Your data, your control</span></div>
          </div>
          <div className="hero-visual" aria-label="Illustration of a career profile connected to a job opportunity">
            <div className="visual-backdrop" />
            <div className="visual-label label-top"><span className="label-dot" />YOUR EXPERIENCE</div>
            <div className="profile-float-card">
              <div className="profile-card-top"><div className="profile-initial">AM</div><div><strong>Your profile</strong><small>Skills + experience</small></div><span className="verified-dot"><Check size={12} /></span></div>
              <div className="mini-skill-list"><span>Product thinking</span><span>Research</span><span>+ your evidence</span></div>
            </div>
            <svg className="path-line" viewBox="0 0 360 180" aria-hidden="true"><path d="M20 140 C105 142 92 36 174 63 S274 148 340 22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" /></svg>
            <div className="path-node node-one"><Fingerprint size={17} /></div><div className="path-node node-two"><ScanSearch size={17} /></div>
            <div className="opportunity-float-card"><div className="opportunity-heading"><span className="opportunity-icon"><Compass size={17} /></span><span className="match-pill"><span />Explained match</span></div><strong>Product designer</strong><small>Evidence-based comparison</small><div className="match-meter"><span /></div><div className="match-foot"><span>Supporting details</span><b>See why</b></div></div>
            <div className="visual-label label-bottom">YOUR NEXT OPPORTUNITY<ArrowDown size={13} /></div>
            <div className="sparkle sparkle-a"><Sparkles size={17} /></div><div className="sparkle sparkle-b"><TrendingUp size={18} /></div>
          </div>
        </div>
        <div className="hero-bottom"><span>Built for the journey between where you are and where you want to be</span><ChevronRight size={15} /></div>
      </section>
      <section className="intro-section">
        <div className="intro-left"><p className="eyebrow">A clearer way forward</p><h2>Your next role isn't a guess.<br /><em>It's a bridge you can build.</em></h2></div>
        <div className="intro-right"><p>Job searching can feel like sending your story into a void. SkillBridge makes the connection visible — the experience that already fits, the skills to strengthen, and the evidence that helps you move with intention.</p><Link className="arrow-link" to="/jobs">See how your skills connect <ArrowRight size={16} /></Link></div>
      </section>
      <section className="loop-section" id="how-it-works">
        <div className="section-heading"><div><p className="eyebrow">The evidence-to-opportunity loop</p><h2>Every step makes<br /><em>the next one clearer.</em></h2></div><p>Useful career intelligence starts with what you know, explains what it sees, and leaves the decisions with you.</p></div>
        <div className="loop-grid">{loop.map(({ number, title, text, icon: Icon }) => <article className="loop-card" key={number}><div className="loop-card-top"><span>{number}</span><Icon size={22} strokeWidth={1.6} /></div><h3>{title}</h3><p>{text}</p><div className="loop-card-foot"><span className="loop-line" /><span>STEP {number}</span></div></article>)}</div>
      </section>
      <section className="principles-section">
        <div className="principles-inner"><div className="principles-heading"><p className="eyebrow">Designed around your agency</p><h2>Clarity you can<br /><em>actually use.</em></h2><Link className="text-link" to="/sign-up">Start with your profile <ArrowRight size={16} /></Link></div>
          <div className="principle-list"><article><span className="principle-icon"><Fingerprint size={20} /></span><div><h3>Grounded in your evidence</h3><p>Every match points to the profile details behind it. Missing information stays unknown — not a penalty.</p></div></article><article><span className="principle-icon"><Target size={20} /></span><div><h3>Made for progress</h3><p>Turn a gap into a small, practical step with a way to show what you learn along the way.</p></div></article><article><span className="principle-icon"><Check size={20} /></span><div><h3>Always yours to review</h3><p>Resume suggestions wait for your confirmation. Your profile visibility and account stay in your control.</p></div></article></div>
        </div>
      </section>
      <section className="featured-jobs"><div className="featured-head"><div><p className="eyebrow">A first look</p><h2>Explore opportunities.</h2></div><Link className="arrow-link" to="/jobs">View all roles <ArrowRight size={16} /></Link></div>
        {jobs.length ? <div className="featured-grid">{jobs.map((job) => <JobCard key={job.id} job={job} compact />)}</div> : <div className="featured-empty">More opportunities appear here as employers publish roles. <Link to="/jobs">Browse current listings <ArrowRight size={14} /></Link></div>}
      </section>
      <section className="final-cta"><div className="cta-orbit orbit-a" /><div className="cta-orbit orbit-b" /><p className="eyebrow">Your next chapter starts with a clearer picture</p><h2>Start with what<br /><em>you already know.</em></h2><p>Build your profile and see where your experience can take you next.</p><Link className="button button-light" to="/sign-up">Create your profile <ArrowRight size={16} /></Link></section>
    </main>
    <Footer />
  </>;
}
