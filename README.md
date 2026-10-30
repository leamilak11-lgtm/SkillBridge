# SkillBridge

**AI Career Intelligence Platform**  
Bridge your skills to your next opportunity.

SkillBridge is an explainable career platform. Resume extraction and feedback run locally by default, and recommendations use deterministic profile-to-job comparisons. When enabled on the server, people can separately opt in to AI resume extraction or AI recommendation guidance. Publicly seeded listings are clearly marked as demo data.

## Requirements

- Node.js 24 or newer
- npm 10 or newer
- Docker Desktop (or another Docker Compose provider) for the local PostgreSQL database

## Start locally

1. Copy .env.example to apps/api/.env. Replace SESSION_SECRET with a random value of at least 32 characters.
2. Install dependencies: npm install
3. Start PostgreSQL: npm run db:up
4. Apply the schema: npm run db:migrate
5. Add the labelled demo listings: npm run db:seed
6. Start the API and web app: npm run dev
7. Open http://localhost:5173. The API health endpoint is http://localhost:4000/api/health.

The web app uses a Vite proxy for /api, so browser requests carry the HTTP-only session cookie to the API. For a deployment, set WEB_ORIGIN, DATABASE_URL, and SESSION_SECRET for the server and serve the web build over HTTPS.

## Useful commands

| Command | Purpose |
| --- | --- |
| npm run dev | Run the API and Vite development server |
| npm run build | Build both workspaces |
| npm run typecheck | Type-check both workspaces |
| npm run lint | Run the workspace lint checks |
| npm test | Run automated API and web checks |
| npm run db:migrate | Apply committed Prisma migrations |
| npm run db:seed | Insert clearly labelled demo jobs |
| npm run db:studio | Open Prisma Studio |
| npm run data:cleanup | Preview eligible expired session, verification/reset-token, and old notification cleanup |

## Demo data and roles

Seeded companies and jobs are demo records and are labelled in the public UI. Seeker registration is separate from recruiter registration; neither signup form can choose an administrator role, and there is no public role-change endpoint.

Recruiters can create a company workspace at `/recruiter/sign-up`. New company workspaces start pending review: recruiters can prepare job drafts, and publishing becomes available after an administrator approves the company. Recruiters can then publish or close jobs and review applications for their company. Recruiter access is scoped by company membership, and a resume is downloadable only when the applicant attached it to that application.

To create the first administrator, set DATABASE_URL and run:

```sh
npm --workspace @skillbridge/api run admin:create -- --email admin@example.com
```

The command prompts for a password without echoing it. The admin role is assigned only by this explicit local CLI.

Administrators sign in at `/sign-in` and use `/app/admin` to review company registrations and reports, moderate listings, and suspend or reinstate accounts. Company, job, report, and account moderation actions are recorded in the audit and moderation logs. No default administrator or recruiter password is included in the seed data.

## Privacy and local limits

- Passwords use Node's scrypt KDF. Session tokens are random, stored hashed, and delivered only in HTTP-only cookies.
- Password sign-up requires a one-time email verification link before login. Set `RESEND_API_KEY` and `EMAIL_FROM` to deliver verification and password-reset messages; local development without a mail key shows one-time links after registration and reset requests. Google sign-in is available on seeker and recruiter registration and sign-in when the Google OAuth settings are configured. Google supplies the verified name and email; recruiter registration also uses the company details entered on that page. Existing Google-linked accounts keep their current role.
- Resume uploads are limited to PDF/DOCX and 5 MB by default. Profile photos accept PNG/JPEG/WebP up to 2 MB. Both use private storage and owner-authenticated access; profile photos are not included in recruiter discovery.
- PDF and DOCX text extraction runs locally. Optional AI resume parsing requires a separate checkbox before upload; it sends up to 24,000 characters of extracted text to OpenAI after removing email addresses, phone numbers, and web links. Parsed profile details remain suggestions until the seeker reviews and confirms them.
- STORAGE_DRIVER=local is the default. STORAGE_DRIVER=s3 uses the private S3-compatible bucket configured by the S3_* variables. No public file URL is generated.
- Password reset uses a one-time email link in configured environments. The development token is returned only when running locally without email delivery configured.
- Candidate discovery is restricted to approved recruiters and profiles whose owners explicitly opted in. Recruiter search omits email, resumes, application history, and private notes. Seeker consent can be revoked from profile settings.
- Application events create in-app notifications for the applicant and the recruiter's company. Notification state is private to the signed-in account.
- Resume feedback is a local checklist of detected sections and rough length. It does not judge a person's ability or promise a hiring outcome.
- Set `OPENAI_API_KEY` to enable optional AI features. Recommendation job order and match scores remain locally computed; AI guidance is requested only after a user opts in on the recommendations page and receives the chosen role, skill names, up to five experience titles and summaries, work preferences, and public job requirements. Resume files, employer names, account contact details, and application history are not included in that request. Resume text is sent only when a user separately opts in during upload.
- Social links are optional build-time settings. Copy `apps/web/.env.example` to `apps/web/.env` and add the real SkillBridge LinkedIn, Instagram, or Telegram profile URLs; the footer displays only configured links. The footer identifies Ethiopia as the service country.

See [docs/architecture.md](docs/architecture.md) for trust boundaries, [docs/test-data.md](docs/test-data.md) for copy-ready samples and manual test paths, and [docs/deployment.md](docs/deployment.md) for container and production operations. The extended tools are available at `/app/interview-prep`, `/app/recommendations`, and `/app/notifications`; approved recruiters can use `/app/recruiter/candidates` to search profiles with explicit seeker consent.
