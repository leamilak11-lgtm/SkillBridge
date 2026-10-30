import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../errors.js";
import { config } from "../config.js";
import { logEvent } from "../logger.js";
export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const status = error instanceof ApiError ? error.status : Number((error as { status?: unknown })?.status);
  logEvent(status >= 500 || !Number.isFinite(status) ? "error" : "warn", "api.error", {
    requestId: String(response.getHeader("X-Request-Id") ?? ""),
    method: request.method,
    route: request.route ? `${request.baseUrl}${String(request.route.path)}` : "unmatched",
    statusCode: status >= 400 && status < 600 ? status : 500,
    errorType: error instanceof Error ? error.name : "UnknownError",
    ...(config.nodeEnv === "development" && error instanceof Error ? { detail: error.message.slice(0, 300) } : {}),
  });
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    return;
  }
  if (error instanceof multer.MulterError) {
    const megabytes = Math.round(config.maxResumeBytes / (1024 * 1024));
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The resume must be " + megabytes + " MB or smaller."
      : "The resume could not be uploaded.";
    response.status(400).json({ error: { code: "UPLOAD_ERROR", message } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: "BAD_REQUEST", message: "Please check the submitted information." } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({ error: { code: "CONFLICT", message: "That record already exists." } });
    return;
  }
  if (status >= 400 && status < 500) {
    response.status(status).json({ error: { code: "BAD_REQUEST", message: "The request could not be completed." } });
    return;
  }
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
};
