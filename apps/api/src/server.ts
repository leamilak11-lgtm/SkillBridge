import "dotenv/config";
import { app } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
const server = app.listen(config.port, "0.0.0.0", () => {
  console.info("SkillBridge API listening on http://localhost:" + config.port);
});
async function shutdown(signal: string) {
  console.info(signal + " received; closing server.");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
