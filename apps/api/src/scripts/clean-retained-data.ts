import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { config } from "../config.js";

async function main() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.dataRetentionDays * 24 * 60 * 60 * 1000);
  const apply = process.argv.includes("--apply");
  const sessionsWhere: Prisma.SessionWhereInput = { expiresAt: { lt: now } };
  const passwordResetsWhere: Prisma.PasswordResetTokenWhereInput = { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] };
  const emailVerificationsWhere: Prisma.EmailVerificationTokenWhereInput = { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] };
  const notificationsWhere: Prisma.NotificationWhereInput = { createdAt: { lt: cutoff } };
  const [sessions, passwordResets, emailVerifications, notifications] = await Promise.all([
    prisma.session.count({ where: sessionsWhere }),
    prisma.passwordResetToken.count({ where: passwordResetsWhere }),
    prisma.emailVerificationToken.count({ where: emailVerificationsWhere }),
    prisma.notification.count({ where: notificationsWhere }),
  ]);
  console.info(JSON.stringify({
    mode: apply ? "apply" : "dry-run", retentionDays: config.dataRetentionDays,
    candidateDeletes: { expiredSessions: sessions, expiredOrUsedPasswordResetTokens: passwordResets, expiredOrUsedEmailVerificationTokens: emailVerifications, oldNotifications: notifications },
  }));
  if (apply) {
    const [sessionResult, resetResult, verificationResult, notificationResult] = await prisma.$transaction([
      prisma.session.deleteMany({ where: sessionsWhere }),
      prisma.passwordResetToken.deleteMany({ where: passwordResetsWhere }),
      prisma.emailVerificationToken.deleteMany({ where: emailVerificationsWhere }),
      prisma.notification.deleteMany({ where: notificationsWhere }),
    ]);
    console.info(JSON.stringify({ deleted: { sessions: sessionResult.count, passwordResetTokens: resetResult.count, emailVerificationTokens: verificationResult.count, notifications: notificationResult.count } }));
  } else {
    console.info("Dry run only. Add --apply to remove these records.");
  }
}

main().catch((error: unknown) => {
  console.error("Data-retention cleanup failed:", error instanceof Error ? error.name : "UnknownError");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
