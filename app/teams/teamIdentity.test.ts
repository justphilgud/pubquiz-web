import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTeamName,
  normalizeTeamPassword,
  teamPasswordMatches,
  validateTeamName,
  validateTeamPassword,
} from "./teamIdentity";

test("team identity uses one trimmed case-insensitive lookup key", () => {
  assert.equal(normalizeTeamName("  Team KOLIBRI "), "team kolibri");
  assert.equal(normalizeTeamName("Kranich"), normalizeTeamName("KRANICH"));
});

test("team name and access word validation reject empty or oversized input", () => {
  assert.match(validateTeamName(" ") ?? "", /Teamnamen/);
  assert.equal(validateTeamName("Kolibri"), null);
  assert.match(validateTeamPassword(" ") ?? "", /Passwort/);
  assert.equal(validateTeamPassword("Adler"), null);
});

test("team password semantics remain trimmed and case-sensitive", () => {
  assert.equal(normalizeTeamPassword(" Adler "), "Adler");
  assert.equal(teamPasswordMatches("Adler", " Adler "), true);
  assert.equal(teamPasswordMatches("Adler", "adler"), false);
  assert.equal(teamPasswordMatches(null, undefined), true);
});
