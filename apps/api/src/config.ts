import { z } from "zod";
const optionalValue = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default(".data/private"),
  MAX_RESUME_BYTES: z.coerce.number().int().min(1024).max(20 * 1024 * 1024).default(5 * 1024 * 1024),
  S3_REGION: optionalValue, S3_BUCKET: optionalValue, S3_ENDPOINT: optionalValue,
  S3_ACCESS_KEY_ID: optionalValue, S3_SECRET_ACCESS_KEY: optionalValue,
  OPENAI_API_KEY: optionalValue,
  OPENAI_MODEL: z.string().trim().min(1).max(100).default("gpt-4.1-mini"),
  RESEND_API_KEY: optionalValue,
  EMAIL_FROM: optionalValue,
  GOOGLE_CLIENT_ID: optionalValue,
  GOOGLE_CLIENT_SECRET: optionalValue,
  GOOGLE_REDIRECT_URI: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(60 * 60 * 1000).default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(20),
  DATA_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(180),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
}).superRefine((value, context) => {
  if (value.STORAGE_DRIVER === "s3") {
    for (const key of ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!value[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required when STORAGE_DRIVER=s3` });
    }
  }
  if (Boolean(value.RESEND_API_KEY) !== Boolean(value.EMAIL_FROM)) {
    context.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "RESEND_API_KEY and EMAIL_FROM must be configured together." });
  }
  const googleSettings = [value.GOOGLE_CLIENT_ID, value.GOOGLE_CLIENT_SECRET, value.GOOGLE_REDIRECT_URI];
  if (googleSettings.some(Boolean) && !googleSettings.every(Boolean)) {
    context.addIssue({ code: "custom", path: ["GOOGLE_CLIENT_ID"], message: "Google OAuth requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI." });
  }
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error("Invalid server configuration: " + z.prettifyError(parsed.error));
export const config = {
  nodeEnv: parsed.data.NODE_ENV, port: parsed.data.PORT, webOrigin: parsed.data.WEB_ORIGIN,
  databaseUrl: parsed.data.DATABASE_URL, sessionSecret: parsed.data.SESSION_SECRET,
  sessionTtlDays: parsed.data.SESSION_TTL_DAYS, storageDriver: parsed.data.STORAGE_DRIVER,
  localStorageDir: parsed.data.LOCAL_STORAGE_DIR, maxResumeBytes: parsed.data.MAX_RESUME_BYTES,
  s3Region: parsed.data.S3_REGION, s3Bucket: parsed.data.S3_BUCKET, s3Endpoint: parsed.data.S3_ENDPOINT,
  s3AccessKeyId: parsed.data.S3_ACCESS_KEY_ID, s3SecretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY,
  openAiApiKey: parsed.data.OPENAI_API_KEY, openAiModel: parsed.data.OPENAI_MODEL,
  resendApiKey: parsed.data.RESEND_API_KEY, emailFrom: parsed.data.EMAIL_FROM,
  googleClientId: parsed.data.GOOGLE_CLIENT_ID, googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: parsed.data.GOOGLE_REDIRECT_URI,
  googleOAuthEnabled: Boolean(parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET && parsed.data.GOOGLE_REDIRECT_URI),
  authRateLimitWindowMs: parsed.data.AUTH_RATE_LIMIT_WINDOW_MS,
  authRateLimitMax: parsed.data.AUTH_RATE_LIMIT_MAX,
  dataRetentionDays: parsed.data.DATA_RETENTION_DAYS,
  trustProxyHops: parsed.data.TRUST_PROXY_HOPS,
} as const;
