import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetsAt: number };

export function createRateLimit(maximum: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();
  let requestsSinceCleanup = 0;
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    if (++requestsSinceCleanup % 200 === 0 || buckets.size > 5000) {
      for (const [key, bucket] of buckets) if (bucket.resetsAt <= now) buckets.delete(key);
      while (buckets.size > 5000) buckets.delete(buckets.keys().next().value as string);
      requestsSinceCleanup = 0;
    }
    const key = request.ip || "unknown";
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetsAt <= now) {
      bucket = { count: 0, resetsAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    response.setHeader("RateLimit-Limit", maximum);
    response.setHeader("RateLimit-Remaining", Math.max(0, maximum - bucket.count));
    response.setHeader("RateLimit-Reset", Math.ceil(bucket.resetsAt / 1000));
    if (bucket.count > maximum) {
      response.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000)));
      response.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many account attempts. Wait a little and try again." } });
      return;
    }
    next();
  };
}
