# SkillBridge architecture and Phase 0 plan

## Phase 0: inspection and decisions

The supplied SkillBridge directory contained no files, including hidden files. There was no framework, database, or working behavior to preserve. The implementation therefore starts with the repository's requested TypeScript monorepo direction.

## Architecture

- apps/web: React, TypeScript, and Vite single-page application. It talks to the API using /api requests with credentials; it does not store session tokens in browser storage.
- apps/api: Express API. Routes validate requests at the boundary, services own business rules, and Prisma is the data access layer.
- PostgreSQL: relational records, constraints, indexes, and checked-in Prisma migrations. Docker Compose provides the local database.
- Authentication: scrypt password hashes and opaque random session cookies. Only a SHA-256 hash of each session token is stored in the database. Password registrations require a hashed, expiring, one-time email-verification token. Google OAuth uses a short-lived, HTTP-only state cookie and accepts only Google's verified email. Cookies are HTTP-only, SameSite=Lax, and Secure in production.
- Resume storage: a private storage interface with local disk and configurable S3-compatible implementations. Resume files are only streamed through an authenticated API route.
- Matching: deterministic weighted dimensions, with unknown dimensions omitted and remaining weights renormalized. It is not an employment probability or hiring decision.
- Resume analysis and career plans: local, rule-based services. Extracted resume content becomes reviewable suggestions; it never silently overwrites profile data.

## Milestones

1. **Phase 1 — working foundation:** workspace and local configuration, database schema and migration, authentication, roles, health endpoint, seed data, and documented startup.
2. **Phase 2 — seeker MVP:** onboarding/profile editing, private resume upload and review, public job search, matching explanations, saved jobs, application tracking, and editable career plan.

3. **Phase 3 - recruiter and administration:** separate recruiter registration, company approval, member-scoped job drafting and publishing, recruiter application management, user reports, and role-protected administration with moderation and audit history.

4. **Phase 4 - extended career intelligence:** local interview practice prompts, local resume structure feedback, consent-gated candidate discovery, in-app application notifications, and optional AI recommendations and resume parsing with local fallback. Recommendation scores and job order are calculated locally. AI recommendations require a page-level opt-in and receive limited profile experience/preferences plus public listing requirements. AI resume parsing requires a separate upload-time opt-in; the API extracts text locally, removes email addresses, phone numbers, and web links, and sends up to 24,000 characters to the provider. Extracted results wait for seeker review before they update profile data.

5. **Phase 5 - production readiness:** deployment guide, structured request/error logs, health probes, bounded requests, operational configuration, and documented data-retention controls. Salary insights remain unavailable until a reliable source is configured; no values are fabricated.

## Trust boundaries

- Public job endpoints expose only published job and company fields.
- Seeker endpoints require a valid session and only operate on the authenticated user's records.
- Password login is unavailable until email verification. The verification token is carried in a URL fragment and only its keyed hash is stored. Google sign-in uses the provider's user-info endpoint over TLS and only creates or links an account when Google confirms the email.
- Recruiter/admin roles are never accepted from self-service registration or profile updates. Local administrator creation uses a separate CLI command and an explicit email/password.
- Recruiter actions are scoped through company memberships. Company approval and suspension control public listing access; publishing is blocked until approval.
- A recruiter only sees applications for jobs at their company. Applicant resumes are streamed only for applications that included that resume.
- Reports, company approval, job status changes, and account suspension are stored in audit and moderation logs. Admin accounts cannot be created through the website or suspended from the moderation UI.
- Recruiter notes are kept separate from seeker notes and are not returned from seeker application endpoints.
- Resume text and files are personal data. Resume text is sent to the optional OpenAI parser only after a separate user opt-in; the uploaded file remains in private storage, while the extracted text stays in the local database.
- Recruiter candidate search requires an approved company and `visibilityPublic=true`. Its response omits contact details and resumes. The seeker can revoke consent at any time.
- Optional AI recommendation requests contain a chosen role, skill names, limited experience summaries, work preferences, and public listing requirements. The recommendation endpoint does not send resume text, employer names, account contacts, or application history. Provider failures fall back to local rules.
- Recruiter job-to-candidate scores use the existing local match explanation over opted-in public profile fields. They are a review aid, not a hiring decision; candidate contact details and private resumes remain excluded.
