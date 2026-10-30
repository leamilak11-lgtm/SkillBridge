import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { createRateLimit } from "./rate-limit.js";

test("auth rate limit allows configured attempts and rejects the next request", () => {
  const limit = createRateLimit(1, 60_000);
  let statusCode = 200;
  let responseBody: unknown;
  const headers: Record<string, string | number> = {};
  const response = {
    setHeader(name: string, value: string | number) { headers[name] = value; return this; },
    status(value: number) { statusCode = value; return this; },
    json(value: unknown) { responseBody = value; return this; },
  } as unknown as Response;
  const request = { ip: "192.0.2.10" } as Request;
  let passed = 0;
  const next = () => { passed += 1; };
  limit(request, response, next);
  limit(request, response, next);
  assert.equal(passed, 1);
  assert.equal(statusCode, 429);
  assert.equal(headers["RateLimit-Limit"], 1);
  assert.deepEqual(responseBody, { error: { code: "RATE_LIMITED", message: "Too many account attempts. Wait a little and try again." } });
});
