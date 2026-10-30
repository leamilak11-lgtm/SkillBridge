# SkillBridge project status

SkillBridge is a full-stack career platform for job seekers, recruiters, and administrators. This repository contains the application source, database schema and migrations, local demo seed data, Docker definitions, and deployment guidance.

## Included product areas

- Public job search, filters, job details, reports, and applications
- Seeker accounts, editable profiles with private photo upload, private resumes, saved jobs, and application tracking
- Required email verification for password registration and optional Google OAuth sign-in for seekers and recruiters; recruiter signup carries company details into the new workspace
- Explainable role recommendations, career plans, resume feedback, and interview practice
- Optional AI resume extraction with user-reviewed skill, experience, education, project, certification, language, role, and headline suggestions
- Candidate discovery ranked against a recruiter-selected job using consented profile evidence and explainable local match details
- Recruiter registration, company review, job drafting and publishing, application review, and consent-based candidate discovery
- Admin company/job/report/account moderation with audit history
- Private local or S3-compatible resume storage, session security, health probes, structured logs, and retention cleanup

## Start locally

Requirements: Node.js 24+, npm 10+, and Docker Compose.

1. Copy `.env.example` to `apps/api/.env`; set `SESSION_SECRET` to a random value of at least 32 characters.
2. Run `npm install`.
3. Run `npm run db:up`, then `npm run db:migrate` and `npm run db:seed`.
4. Run `npm run dev` and open `http://localhost:5173`.
5. Check API readiness at `http://localhost:4000/api/health/ready`.

The seed command creates labelled demo listings, not real job openings. Create an administrator explicitly with `npm --workspace @skillbridge/api run admin:create -- --email admin@example.com`; the CLI prompts for a password.

## Configuration and operations

See `.env.example` for API variables and `apps/web/.env.example` for optional footer social links. Local private uploads are stored under `apps/api/.data/private` by default. OpenAI features are unavailable unless `OPENAI_API_KEY` is configured. Email verification requires Resend settings in production; Google sign-in requires Google OAuth credentials. AI resume parsing and AI recommendation summaries have separate user opt-ins. See [docs/deployment.md](docs/deployment.md) before deploying, and [docs/architecture.md](docs/architecture.md) for security boundaries and data flow.

Useful commands: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run db:studio`, and `npm run data:cleanup` (preview; add `-- --apply` to delete eligible records).

## Current scope and limits

The application is an MVP, not a hosted production service. Verification and password-reset email delivery require Resend settings; local development can display one-time links when email is not configured. Salary insights are omitted until a reliable data source exists. Job and candidate matching are deterministic guidance, not hiring decisions. Candidate search only returns profiles whose owners enabled public visibility. Real social account URLs must be supplied in the web app's environment before they appear in the footer.

## Completion check

The source tree includes both application workspaces, Prisma migration history, seed data, unit tests, Dockerfiles, Compose configuration, and operating documentation. Run the commands above in an environment with Docker available to validate the local database workflow. Build and test commands should be run after installing dependencies.
