import type { NextFunction, Request, Response } from "express";
import { logEvent } from "../logger.js";

export function requestLogging(request: Request, response: Response, next: NextFunction) {
  const started = performance.now();
  response.once("finish", () => {
    if (request.path === "/api/health/live") return;
    const statusCode = response.statusCode;
    logEvent(statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info", "http.request", {
      requestId: String(response.getHeader("X-Request-Id") ?? ""),
      method: request.method,
      route: request.route ? `${request.baseUrl}${String(request.route.path)}` : "unmatched",
      statusCode,
      durationMs: Math.max(0, Math.round(performance.now() - started)),
    });
  });
  next();
}
