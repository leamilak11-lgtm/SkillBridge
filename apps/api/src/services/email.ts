import { config } from "../config.js";
import { serviceUnavailable } from "../errors.js";

export function emailDeliveryConfigured() {
  return Boolean(config.resendApiKey && config.emailFrom);
}

export async function sendVerificationEmail(email: string, name: string, verificationUrl: string) {
  if (!config.resendApiKey || !config.emailFrom) {
    throw serviceUnavailable("Email delivery is not configured. Please contact the site administrator.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: "Verify your SkillBridge email",
      text: `Hello ${name},\n\nVerify your email address to finish creating your SkillBridge account:\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this message.`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>Verify your email address to finish creating your SkillBridge account.</p><p><a href="${escapeHtml(verificationUrl)}">Verify my email</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this message.</p>`,
    }),
  });
  if (!response.ok) throw serviceUnavailable("The verification email could not be sent. Please request a new email and try again.");
}

export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string) {
  if (!config.resendApiKey || !config.emailFrom) {
    throw serviceUnavailable("Email delivery is not configured. Please contact the site administrator.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: "Reset your SkillBridge password",
      text: `Hello ${name},\n\nUse this one-time link to reset your SkillBridge password:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request a reset, you can ignore this message.`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>Use this one-time link to reset your SkillBridge password.</p><p><a href="${escapeHtml(resetUrl)}">Reset my password</a></p><p>This link expires in 30 minutes. If you did not request a reset, you can ignore this message.</p>`,
    }),
  });
  if (!response.ok) throw serviceUnavailable("The password reset email could not be sent. Please request a new link and try again.");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}
