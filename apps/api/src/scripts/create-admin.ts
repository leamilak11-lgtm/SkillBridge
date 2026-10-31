import "dotenv/config";
import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";
import { prisma } from "../db.js";
import { hashPassword } from "../security/password.js";
const emailArg = process.argv.find((arg) => arg.startsWith("--email="))?.slice("--email=".length)
  ?? (process.argv.includes("--email") ? process.argv[process.argv.indexOf("--email") + 1] : undefined);
if (!emailArg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailArg)) {
  console.error("Usage: npm --workspace @skillbridge/api run admin:create -- --email admin@example.com");
  process.exit(1);
}
async function readPassword(): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    const configured = process.env.ADMIN_PASSWORD;
    if (!configured) throw new Error("Set ADMIN_PASSWORD for non-interactive use, or run this command in a terminal.");
    return configured;
  }
  stdout.write("New administrator password (10+ characters): ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let password = "";
  return new Promise((resolve, reject) => {
    const onData = (character: string) => {
      if (character === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
        reject(new Error("Cancelled."));
        return;
      }
      if (character === "\r" || character === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(password);
      } else if (character === "\u007f" || character === "\b") password = password.slice(0, -1);
      else password += character;
    };
    stdin.on("data", onData);
  });
}
const password = await readPassword();
if (password.length < 10 || password.length > 128) {
  console.error("The password must be 10 to 128 characters.");
  process.exit(1);
}
const email = emailArg.toLowerCase();
const existing = await prisma.user.findUnique({ where: { email } });
const user = existing
  ? await prisma.user.update({ where: { email }, data: { role: "ADMIN", passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } })
  : await prisma.user.create({ data: { name: "SkillBridge Administrator", username: "admin_" + randomBytes(6).toString("hex"), phone: null, email, passwordHash: await hashPassword(password), role: "ADMIN", emailVerifiedAt: new Date() } });
console.info("Administrator account ready for " + user.email + ".");
await prisma.auditLog.create({ data: { actorId: user.id, action: "ADMIN_ACCOUNT_CREATED", target: user.email } });
await prisma.$disconnect();
