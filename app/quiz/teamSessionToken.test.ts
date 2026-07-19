import assert from "node:assert/strict";
import test from "node:test";
import {
  issueTeamSessionToken,
  TEAM_SESSION_TOKEN_TTL_SECONDS,
  verifyTeamSessionToken,
} from "./teamSessionToken";

const secret = "test-secret-with-sufficient-entropy";

test("a signed team session token carries quiz, session, version and expiry", () => {
  const token = issueTeamSessionToken({ quizId: 7, sessionId: 19 }, secret, 100);
  assert.deepEqual(verifyTeamSessionToken(token, secret, 101), {
    version: 1,
    quizId: 7,
    sessionId: 19,
    expiresAt: 100 + TEAM_SESSION_TOKEN_TTL_SECONDS,
  });
});

test("tampered, wrongly signed and expired tokens are rejected", () => {
  const token = issueTeamSessionToken({ quizId: 7, sessionId: 19 }, secret, 100);
  const [payload, signature] = token.split(".");
  assert.equal(verifyTeamSessionToken(`${payload}x.${signature}`, secret, 101), null);
  assert.equal(verifyTeamSessionToken(token, "different-secret", 101), null);
  assert.equal(
    verifyTeamSessionToken(token, secret, 100 + TEAM_SESSION_TOKEN_TTL_SECONDS),
    null,
  );
});

test("malformed tokens are rejected", () => {
  assert.equal(verifyTeamSessionToken("not-a-token", secret), null);
  assert.equal(verifyTeamSessionToken("a.b.c", secret), null);
  assert.equal(verifyTeamSessionToken("", secret), null);
});
