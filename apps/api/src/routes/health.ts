import { Router, type RequestHandler } from "express";
import { prisma } from "../db.js";
export const healthRouter = Router();
healthRouter.get("/live", (_request, response) => {
  response.json({ status: "ok", service: "api", timestamp: new Date().toISOString() });
});
const readiness: RequestHandler = async (_request, response) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    response.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch {
    response.status(503).json({ status: "degraded", database: "unavailable", timestamp: new Date().toISOString() });
  }
};
healthRouter.get("/ready", readiness);
healthRouter.get("/", readiness);
