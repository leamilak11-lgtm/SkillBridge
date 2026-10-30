import test from "node:test";
import assert from "node:assert/strict";
import { explainMatch, normalizeSkill } from "./matching.js";

test("normalizes documented JavaScript aliases", () => {
  assert.equal(normalizeSkill("JS"), "javascript");
  assert.equal(normalizeSkill("React.js"), "react");
});

test("does not turn missing profile skills into a negative match", () => {
  const result = explainMatch({ skills: [], experiences: [] }, {
    title: "Frontend developer", workArrangement: "REMOTE", employmentType: "FULL_TIME",
    skills: [{ required: true, skill: { name: "JavaScript" } }],
  });
  assert.equal(result.score, null);
  assert.deepEqual(result.notYetEvidencedSkills, ["JavaScript"]);
  assert.ok(result.unknownDimensions.includes("Skills"));
});

test("scores partial required skill evidence and reports the gap", () => {
  const result = explainMatch({
    skills: [{ skill: { name: "JS" }, evidence: "Built a small browser tool." }],
    experiences: [],
  }, {
    title: "Frontend developer", workArrangement: "REMOTE", employmentType: "FULL_TIME",
    skills: [
      { required: true, skill: { name: "JavaScript" } },
      { required: true, skill: { name: "Python" } },
    ],
  });
  assert.equal(result.score, 50);
  assert.deepEqual(result.missingRequiredSkills, ["Python"]);
  assert.equal(result.matchingSkills[0]?.evidence, "Built a small browser tool.");
});

test("renormalizes around unknown dimensions", () => {
  const result = explainMatch({
    location: "Nairobi, Kenya",
    skills: [{ skill: { name: "SQL" } }],
    experiences: [],
  }, {
    title: "Data analyst", location: "Nairobi, Kenya", workArrangement: "ONSITE",
    employmentType: "FULL_TIME", skills: [{ required: true, skill: { name: "SQL" } }],
  });
  assert.equal(result.score, 100);
  assert.ok(result.unknownDimensions.includes("Salary"));
  assert.ok(result.unknownDimensions.includes("Industry"));
});
