import assert from "node:assert/strict";
import test from "node:test";
import { reviewResume } from "./resume-feedback.js";

test("resume feedback spots common sections and grounded impact evidence", () => {
  const feedback = reviewResume("Summary: Analyst. Skills: SQL and Python. Experience: Built 12 monthly reports for 4 teams. Education: Data analysis.");
  assert.equal(feedback.items.find((item) => item.key === "summary")?.found, true);
  assert.equal(feedback.items.find((item) => item.key === "impact")?.found, true);
  assert.equal(feedback.items.find((item) => item.key === "education")?.found, true);
  assert.match(feedback.note, /not a measure of your ability/);
});

test("resume feedback does not claim that an empty document is a strong resume", () => {
  const feedback = reviewResume("");
  assert.equal(feedback.score, 0);
  assert.equal(feedback.wordCount, 0);
  assert.ok(feedback.items.some((item) => !item.found));
});
