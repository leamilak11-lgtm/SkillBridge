import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.js";

test("password hashes verify only for the original password", async () => {
  const encoded = await hashPassword("a-long-local-password");
  assert.ok(encoded.startsWith("scrypt$"));
  assert.equal(await verifyPassword("a-long-local-password", encoded), true);
  assert.equal(await verifyPassword("another-password", encoded), false);
});

test("malformed password hashes are rejected", async () => {
  assert.equal(await verifyPassword("password", "not-a-hash"), false);
});
