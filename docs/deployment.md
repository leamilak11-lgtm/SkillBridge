# Deployment and operations

This guide describes a production deployment using the included API and web containers. Use a hosting service that can run Docker images, connect services on a private network, provide managed PostgreSQL, store secrets, and issue HTTPS certificates. Run PostgreSQL as a managed database or a separately operated service. The repository's `docker-compose.yml` is for local development and uses local demo credentials; do not use that database configuration for production.

## Build images

Build from the repository root so Docker can read the npm workspace lockfile:

```sh
docker build -f apps/api/Dockerfile -t skillbridge-api:latest .
docker build -f apps/web/Dockerfile -t skillbridge-web:latest .
```

The API image listens on port 4000. The web image listens on port 8080 and proxies `/api` to the API over the private network. Publish only the web image to the internet; set its `API_UPSTREAM` runtime variable to the API's private service address, such as `http://api:4000`. This keeps the browser, API, and secure session cookie on one public origin.

## Deployment steps

1. Push this repository to your Git provider and connect it to a Docker-capable hosting service.
2. Create a managed PostgreSQL database. Copy its private connection string for `DATABASE_URL`; allow connections only from your app or release runner.
3. Build both images from the repository root. The API Dockerfile builds the server. The web Dockerfile builds the static app and its Nginx reverse proxy. The root `.dockerignore` excludes local environment files, private uploads, dependencies, and build output from the Docker build context. For example:

   ```sh
   docker build -f apps/api/Dockerfile -t skillbridge-api:latest .
   docker build -f apps/web/Dockerfile -t skillbridge-web:latest \
     --build-arg VITE_SOCIAL_LINKEDIN_URL=https://www.linkedin.com/company/your-page \
     --build-arg VITE_SOCIAL_INSTAGRAM_URL=https://www.instagram.com/your-account \
     --build-arg VITE_SOCIAL_TELEGRAM_URL=https://t.me/your-channel .
   ```

   Social links are public build-time settings. Leave a build argument out or empty until you have the real account URL; the footer hides links that are not configured. These values are included in the web build, so changing them requires rebuilding the web image.
4. Deploy the API and web images in the same private network. Set `API_UPSTREAM` on the web service to the API's private address. Give the web service the public domain and HTTPS; do not expose the API port directly.
5. Add the API settings listed below through the hosting service's secret/environment settings. Set `WEB_ORIGIN` to the public HTTPS origin with no trailing slash. Mount durable private storage at `/data` if using `STORAGE_DRIVER=local`; for multiple instances, use private S3-compatible storage.
6. Before sending traffic to the new API version, run `npm ci` and `npm run db:migrate` from this repository with the production `DATABASE_URL` available to the release job. Do not run the demo seed command on a live site unless you want the clearly labelled demo listings there.
7. Configure email and OAuth as described below, deploy, then open `/api/health/ready` through the public domain. Create the first administrator with the CLI command below using a controlled release/admin environment connected to the production database.

## Required API configuration

- `NODE_ENV=production`
- `PORT=4000`
- `WEB_ORIGIN=https://your-public-host.example` (the browser origin, with no trailing slash)
- `DATABASE_URL` (managed PostgreSQL connection string)
- `SESSION_SECRET` (random secret, at least 32 characters)
- `TRUST_PROXY_HOPS=1` when the API receives traffic through the single trusted web reverse proxy; otherwise leave it at `0`
- `STORAGE_DRIVER=s3` with `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`, or mount durable private storage at `/data`

## Email verification and Google sign-in

Password registrations require email verification. Configure `RESEND_API_KEY` and `EMAIL_FROM` together with a verified sender domain in Resend; this sender also delivers password-reset links. In local development, if those settings are empty, registration displays a one-time verification link on screen instead of sending email; production registration and password-reset requests require delivery to be configured.

To enable Google sign-in, create a Google OAuth web client and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Register the redirect URI in Google Cloud exactly as configured on the server. For local development use `http://localhost:4000/api/auth/google/callback`; behind the production web reverse proxy use `https://your-public-host.example/api/auth/google/callback`. A direct Google signup creates a seeker account by default; recruiter signup carries the role and company details through the OAuth callback. Existing accounts sign in with their current role when the verified Google email matches.

Google is shown on both seeker and recruiter registration pages and on sign-in. A new seeker account uses the verified Google name and email. A new recruiter account uses that same Google identity plus the company name and optional details entered on the recruiter registration page; its company workspace starts pending administrator review. If the Google email already belongs to an account, sign-in keeps that account's existing role and workspace. Google verifies the email, so that account can sign in without a separate email-link step.

Run migrations as a release step using the repository's migration command, before new API instances receive traffic:

```sh
npm ci
npm run db:migrate
```

Seeded listings are demo records. Run `npm run db:seed` only in an environment where those labelled samples are appropriate. Create the first administrator with `npm --workspace @skillbridge/api run admin:create -- --email admin@example.com`; the CLI prompts for a password.

## Health, logs, and limits

- `/api/health/live` checks that the API process can answer. Container orchestration can use it as a liveness probe.
- `/api/health/ready` checks the database and returns HTTP 503 while PostgreSQL is unavailable. `/api/health` remains an alias.
- API requests and errors are written as structured JSON to stdout/stderr. Request logs include an ID, route template, status, and duration; they exclude request bodies, query strings, cookies, and account details. Send container logs to the host's log aggregation and alerting service.
- Authentication endpoints have an in-memory per-process IP limit, configurable with `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX`. For multiple API replicas, enforce a shared limit at the trusted gateway or replace the in-memory limiter with a shared store.
- Keep TLS termination at a trusted proxy. Set `TRUST_PROXY_HOPS` only to the number of trusted proxies so secure cookies and client IP handling are correct.
- Configure the proxy's body limit to match `MAX_RESUME_BYTES` (default 5 MB). The sample Nginx configuration allows up to 21 MB to leave room for multipart overhead.

## Private files and optional integrations

Use private, non-public S3-compatible storage for horizontally scaled production deployments. Keep credentials in the hosting provider's secret manager, and restrict the bucket to the API service. Local storage requires a durable private volume and is not suitable for ephemeral containers.

`OPENAI_API_KEY` is optional. If configured, AI recommendation guidance is requested only after a seeker opts in on the recommendations page; it sends the chosen role, skill names, up to five experience titles and summaries, work preferences, and public listing requirements. Job ranking remains local. Resume parsing has a separate upload-time checkbox; after local text extraction, up to 24,000 characters are sent to OpenAI with email addresses, phone numbers, and web links removed. AI results are saved as reviewable suggestions, and only seeker-confirmed details update a profile. Leave the key unset to keep both AI features unavailable and use local rules.

The public footer supports SkillBridge LinkedIn, Instagram, and Telegram profile URLs. For a local Vite build, set `VITE_SOCIAL_LINKEDIN_URL`, `VITE_SOCIAL_INSTAGRAM_URL`, and `VITE_SOCIAL_TELEGRAM_URL` in `apps/web/.env`; for the Docker image, pass the matching `--build-arg` values shown above. Only HTTPS links on the expected social domains are displayed. The footer identifies Ethiopia as the service country. See `apps/web/.env.example` for the variables.

Salary and labor-market insights are not displayed because no reliable data source is configured. Add such data only with documented provenance, publication date, currency, geography, and sample size.

## Data retention

The default `DATA_RETENTION_DAYS=180` applies to in-app notifications. Expired sessions and expired or used password-reset and email-verification tokens are also eligible for cleanup. Resumes remain until the seeker deletes them or deletes their account; audit and moderation history is retained for operational review.

Preview cleanup counts first:

```sh
npm run data:cleanup
```

Review the counts, then explicitly apply the cleanup:

```sh
npm run data:cleanup -- --apply
```

Schedule the apply command through a controlled job runner. Back up the database and private file storage according to the hosting provider's recovery policy.
