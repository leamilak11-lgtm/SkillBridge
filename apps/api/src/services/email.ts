import { config } from "../config.js";
import { serviceUnavailable } from "../errors.js";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function emailDeliveryConfigured() {
  return Boolean(config.resendApiKey && config.emailFrom);
}

export async function sendVerificationEmail(email: string, name: string, verificationUrl: string) {
  await sendEmail({
    to: email,
    subject: "Verify your SkillBridge email",
    text: `Hello ${name},\n\nVerify your email address to finish creating your SkillBridge account:\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this message.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Verify your email address to finish creating your SkillBridge account.</p><p><a href="${escapeHtml(verificationUrl)}">Verify my email</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this message.</p>`,
  }, "verification");
}

export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string) {
  await sendEmail({
    to: email,
    subject: "Reset your SkillBridge password",
    text: `Hello ${name},\n\nUse this one-time link to reset your SkillBridge password:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request a reset, you can ignore this message.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Use this one-time link to reset your SkillBridge password.</p><p><a href="${escapeHtml(resetUrl)}">Reset my password</a></p><p>This link expires in 30 minutes. If you did not request a reset, you can ignore this message.</p>`,
  }, "password_reset");
}

async function sendEmail(message: EmailMessage, emailType: "verification" | "password_reset") {
  if (!config.resendApiKey || !config.emailFrom) {
    throw serviceUnavailable("Email delivery is not configured. Please contact the site administrator.");
  }

  const senderAddress = config.emailFrom.match(/<([^>]+)>/)?.[1] ?? config.emailFrom;
  const senderDomain = senderAddress.split("@").at(-1)?.toLowerCase();
  if (senderDomain === "resend.app" || senderDomain?.endsWith(".resend.app")) {
    console.error(JSON.stringify({
      event: "email.delivery.failed",
      provider: "resend",
      emailType,
      reason: "inbound_only_sender_domain",
    }));
    throw serviceUnavailable("EMAIL_FROM is an inbound-only Resend address. Set it to an address on a sending domain verified in Resend, such as SkillBridge <no-reply@your-verified-domain.com>.");
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.emailFrom, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "email.delivery.failed",
      provider: "resend",
      emailType,
      reason: "network_error",
      errorType: error instanceof Error ? error.name : "UnknownError",
    }));
    throw serviceUnavailable("SkillBridge could not connect to the email service. Please try again later.");
  }

  if (!response.ok) {
    const providerError = await response.json().catch(() => ({})) as Record<string, unknown>;
    console.error(JSON.stringify({
      event: "email.delivery.failed",
      provider: "resend",
      emailType,
      statusCode: response.status,
      providerCode: safeProviderField(providerError.name),
      providerMessage: redactEmailAddresses(safeProviderField(providerError.message)),
    }));
    throw serviceUnavailable(emailType === "verification"
      ? "Resend rejected the verification email. Check the sending domain and EMAIL_FROM setting in Render, then try again."
      : "Resend rejected the password reset email. Check the sending domain and EMAIL_FROM setting in Render, then try again.");
  }
}

function safeProviderField(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.slice(0, 300).replace(/[\r\n\t]/g, " ");
}

function redactEmailAddresses(value: string | undefined) {
  return value?.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}
