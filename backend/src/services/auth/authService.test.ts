import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createAuthService } from "./authService";

function service(secret = "test-secret") {
  return createAuthService({
    username: "admin",
    passwordHash: bcrypt.hashSync("correct-horse", 4),
    secret
  });
}

test("authService: checkCredentials accepts matching username+password and rejects everything else", async () => {
  const auth = service();

  assert.equal(await auth.checkCredentials("admin", "correct-horse"), true);
  assert.equal(await auth.checkCredentials("admin", "wrong-password"), false);
  assert.equal(await auth.checkCredentials("someone-else", "correct-horse"), false);
});

test("authService: createSessionToken + verifySessionToken round-trip for the configured user", () => {
  const auth = service();

  const token = auth.createSessionToken("admin");
  assert.equal(auth.verifySessionToken(token), true);
  assert.equal(auth.verifySessionToken("token-invalido"), false);
});

test("authService: verifySessionToken rejects a token signed with a different secret", () => {
  const authA = service("secret-a");
  const authB = service("secret-b");

  const token = authA.createSessionToken("admin");
  assert.equal(authB.verifySessionToken(token), false);
});
