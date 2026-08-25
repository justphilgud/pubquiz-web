import assert from "node:assert/strict";
import test from "node:test";
import { TEAM_PASSWORT_WOERTER } from "@/app/lib/teamPasswortWoerter";
import { generateTeamPassword } from "./teamPassword";

test("team password generation keeps using the existing team word list", () => {
  assert.equal(generateTeamPassword(() => 0), TEAM_PASSWORT_WOERTER[0]);
  assert.equal(
    generateTeamPassword(() => 0.999999),
    TEAM_PASSWORT_WOERTER[TEAM_PASSWORT_WOERTER.length - 1],
  );
  assert.ok(TEAM_PASSWORT_WOERTER.includes(generateTeamPassword()));
});
