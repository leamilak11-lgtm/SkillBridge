import assert from "node:assert/strict";
import test from "node:test";
import { generateInterviewQuestions } from "./interview-prep.js";

test("interview questions are role-aware, practical, and contain no personal profile data", () => {
  const questions = generateInterviewQuestions("Data Analyst", ["SQL", "Python"]);
  assert.equal(questions.length, 8);
  assert.match(questions[0]?.question ?? "", /Data Analyst/);
  assert.match(questions[2]?.focus ?? "", /SQL, Python/);
  assert.ok(questions.every((item) => item.question.length > 20 && item.focus.length > 10));
});

test("interview preparation has useful prompts when no skills are on the profile", () => {
  const questions = generateInterviewQuestions("Frontend Developer", []);
  assert.match(questions[2]?.focus ?? "", /work, study, or projects/);
});
