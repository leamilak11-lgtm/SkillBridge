# SkillBridge sample data for testing

All people, projects, employers, and contact details in this guide are fictional. Use these records in a local test database only. The seeded job listings are labelled as demos and are not live vacancies.

## Seeded positions

Run `npm run db:seed` after applying the database migration. Search `/jobs` for these exact titles:

| Position | Demo employer | Arrangement | Required skills | Preferred skill |
| --- | --- | --- | --- | --- |
| Frontend Developer | Demo — Greenpath Studio | Hybrid, full time | TypeScript, React | Accessibility |
| Data Analyst | Demo — Open Field Analytics | Remote, full time | SQL, Python | Data visualization |
| Product Designer | Demo — Cedar Works | On-site, contract | Figma, Prototyping | Accessibility |

The sample profiles below are designed to give each listing a strong, explainable match. Paste the values into **Your career profile** (`/app/profile`). The pipe-separated rows follow the formats displayed by the profile form. You may use a different email and password for each seeker account.

## Frontend Developer profile

- **Full name:** Alex Sample
- **Professional headline:** Frontend developer building accessible, reliable web products
- **Location:** Nairobi, Kenya
- **Short biography:** I build responsive web interfaces and enjoy turning product requirements into clear, accessible experiences. I work with designers and engineers to ship maintainable features and improve them from user feedback.
- **Skills** (one per line: `skill | level | years | evidence`):

  ```text
  TypeScript | Advanced | 3 | Built typed interfaces and shared components for production web apps
  React | Advanced | 3 | Delivered responsive pages, forms, and dashboards using reusable components
  Accessibility | Intermediate | 2 | Improved keyboard navigation, labels, and screen-reader feedback
  JavaScript | Advanced | 4 | Maintained browser features and integrated REST APIs
  ```

- **Experience** (one per line: `role | company | what you did | start YYYY-MM | end YYYY-MM or current`):

  ```text
  Frontend Developer | Sample Product Lab | Built React and TypeScript features and improved accessibility | 2022-04 | current
  ```

- **Education** (`qualification | institution | field`):

  ```text
  BSc | Example University | Information Technology
  ```

- **Projects** (`name | description | link`):

  ```text
  Community Services Directory | Built a responsive directory with accessible search and filters | https://example.org/frontend-demo
  ```

- **Desired roles:** Frontend Developer, UI Engineer
- **Desired industries:** Technology, Software
- **Preferred locations:** Nairobi, Remote
- **Work arrangements:** Hybrid, Remote
- **Employment types:** Full time

## Data Analyst profile

- **Full name:** Casey Sample
- **Professional headline:** Data analyst translating operational data into useful decisions
- **Location:** Kisumu, Kenya
- **Short biography:** I clean and analyze data, then communicate the results in practical reports. I like making assumptions clear and building repeatable analysis that teams can maintain.
- **Skills** (one per line: `skill | level | years | evidence`):

  ```text
  SQL | Advanced | 3 | Joined and validated multi-table datasets for recurring reports
  Python | Intermediate | 2 | Used pandas to clean, explore, and summarize operational data
  Data visualization | Intermediate | 2 | Created clear charts and dashboard views for non-technical teams
  Excel | Advanced | 4 | Built audited workbooks with pivots, formulas, and data checks
  ```

- **Experience** (one per line: `role | company | what you did | start YYYY-MM | end YYYY-MM or current`):

  ```text
  Data Analyst | Sample Insights Group | Queried service data, automated checks, and presented monthly findings | 2022-02 | current
  ```

- **Education** (`qualification | institution | field`):

  ```text
  BSc | Example University | Statistics
  ```

- **Projects** (`name | description | link`):

  ```text
  Service Response Dashboard | Analyzed fictional service data and documented trends, caveats, and SQL queries | https://example.org/analyst-demo
  ```

- **Desired roles:** Data Analyst, Business Intelligence Analyst
- **Desired industries:** Analytics, Technology
- **Preferred locations:** Remote, Kisumu
- **Work arrangements:** Remote, Hybrid
- **Employment types:** Full time

## Product Designer profile

- **Full name:** Jordan Sample
- **Professional headline:** Product designer making complex workflows easier to use
- **Location:** Nairobi, Kenya
- **Short biography:** I research user needs, prototype possible solutions, and work with engineering teams to deliver thoughtful product experiences. I value accessible design and clear communication about trade-offs.
- **Skills** (one per line: `skill | level | years | evidence`):

  ```text
  Figma | Advanced | 4 | Built component libraries, page flows, and interactive prototypes
  Prototyping | Advanced | 3 | Tested task flows with users and revised interaction details
  Accessibility | Intermediate | 2 | Reviewed contrast, focus order, and form feedback during design handoff
  User research | Intermediate | 3 | Planned interviews and summarized usability findings for a product team
  ```

- **Experience** (one per line: `role | company | what you did | start YYYY-MM | end YYYY-MM or current`):

  ```text
  Product Designer | Sample Design Workshop | Researched and prototyped an improved onboarding workflow | 2022-06 | current
  ```

- **Education** (`qualification | institution | field`):

  ```text
  BA | Example University | Interaction Design
  ```

- **Projects** (`name | description | link`):

  ```text
  Accessible Booking Flow | Prototyped and tested a simpler booking journey with clear form states | https://example.org/designer-demo
  ```

- **Desired roles:** Product Designer, UX Designer
- **Desired industries:** Design, Technology
- **Preferred locations:** Nairobi
- **Work arrangements:** On-site, Hybrid
- **Employment types:** Contract

## Manual test paths

### Seeker: profile, match, and application

1. Create a seeker account at `/sign-up`, open the verification link (shown after registration in local development without email configured), then sign in.
2. Paste one position's sample into `/app/profile`, then save it.
3. Open `/jobs`, search the matching title, and inspect the role's match explanation. The sample includes every required and preferred skill for its corresponding listing.
4. For a gap case, remove one required skill from the profile, save, and view the match explanation again. The missing required skill should be identified.
5. Save the role, open it, and apply. An application can be submitted without a resume; a cover letter is optional. Check `/app/applications` for the submitted application.

### Recruiter: company approval and application queue

1. Register a separate recruiter at `/recruiter/sign-up`, verify the email, then sign in. Use a fictional test company and account details. Do not use the hidden seeded demo recruiter account; it has a random password and is intended only to own seeded listings.
2. Sign in and open the recruiter workspace. The new company is pending review, so prepare a draft and verify that publishing is unavailable.
3. Ask the local administrator account to approve the company (steps below). Return to the recruiter workspace, publish the draft, and confirm it appears in `/jobs`.
4. Apply to the published listing with a separate seeker account. Return to the recruiter's applications page, review the application, change its status, and add a private recruiter note.
5. Attach a resume to a separate application to verify the recruiter can download only that application’s attached file. The recruiter's queue is limited to its own company.

### Administrator: moderation controls

1. Create an administrator using the local CLI from the project root:

   ```sh
   npm --workspace @skillbridge/api run admin:create -- --email admin@example.com
   ```

   Enter a unique local-test password when prompted. There is no default administrator password.

2. Sign in at `/sign-in` with that account and open `/app/admin`.
3. Approve the new test company from the recruiter flow, then verify its published listing appears in the admin listing queue.
4. Test suspend/reinstate on the test listing or test user and confirm the updated state in the admin workspace. For the persisted record, open Prisma Studio with `npm run db:studio` and inspect `moderation_actions` and `audit_logs`.
5. To test reports, sign in as a seeker, report a demo listing with a specific reason, then review and resolve or dismiss it from the admin page.

### Phase 4: career intelligence, notifications, and consent

1. As a seeker, open `/app/interview-prep`. Use each sample profile's matching position or select its seeded job; practice prompts should name the role and its skills. Practice notes exist only in the open page.
2. Open `/app/recommendations`. Review the local match explanation and the required skill gaps. To test the optional provider, configure `OPENAI_API_KEY` locally and reload; without a key the local explanation remains available.
3. Apply to a role and confirm an application notification appears under `/app/notifications`. As the recruiter, move the application to **Under review** and verify that the seeker receives an update.
4. As a seeker, turn on **Allow recruiter discovery** in `/app/profile`. Sign in as a recruiter whose company is approved, search `/app/recruiter/candidates` by a sample skill, and verify that only opted-in profiles appear. Confirm the results do not show email addresses or resume download links. Turn consent off and search again; that profile should disappear.
5. Upload a fictional PDF or DOCX resume and inspect the local structure checklist. Confirm that feedback is presented as a rough checklist and skill suggestions still require your approval.

### Phase 5: operations

1. Check `/api/health/live` for an API process response and `/api/health/ready` for the database readiness state.
2. Run `npm run data:cleanup` and confirm it reports eligible counts without deleting records. Use `-- --apply` only after reviewing the output in a maintenance window.
3. Send more than `AUTH_RATE_LIMIT_MAX` attempts to a local authentication endpoint from one client address and confirm later requests receive HTTP 429 with a retry interval.
4. When Docker is available, build the API and web containers using the commands in [deployment.md](deployment.md), then verify the web container forwards `/api` to the API service and the API's readiness probe reflects database state.

## Local environment

Use the setup in the project [README](../README.md): install dependencies, copy `.env.example` to `apps/api/.env`, set a development `SESSION_SECRET` of at least 32 characters, start PostgreSQL, run migrations and seed data, then start the API and web app. Avoid real personal information in local test accounts or resumes.
