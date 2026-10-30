import type { Request } from "express";
import type { ZodType } from "zod";
import { badRequest } from "../errors.js";
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw badRequest("Please check the highlighted information.", parsed.error.issues.map((issue) => ({
    path: issue.path.join("."), message: issue.message,
  })));
  return parsed.data;
}
export function requestBody<T>(request: Request, schema: ZodType<T>): T {
  return parseInput(schema, request.body);
}
export function routeParam(request: Request, key: string): string {
  const value = request.params[key];
  if (typeof value !== "string" || !value) throw badRequest("A route parameter is missing or invalid.");
  return value;
}
