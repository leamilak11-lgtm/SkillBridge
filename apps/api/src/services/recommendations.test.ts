import assert from "node:assert/strict";
import test from "node:test";
import { localRecommendationSummary, requestOptionalAiSummary } from "./recommendations.js";

test("local recommendations explain role evidence and a practical gap step", () => {
  const result = localRecommendationSummary("Frontend Developer", ["React"], [
    { title: "Frontend Developer", skills: ["React", "TypeScript"], missingRequiredSkills: ["TypeScript"] },
  ]);
  assert.match(result, /React/);
  assert.match(result, /TypeScript/);
  assert.match(result, /example/);
});

test("optional AI enhancement is skipped when there is no configured key", async () => {
  const result = await requestOptionalAiSummary({ model: "gpt-4.1-mini", targetRole: "Analyst", skills: [], opportunities: [] });
  assert.equal(result, null);
});
