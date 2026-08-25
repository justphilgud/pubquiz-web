import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("app/teams/actions.ts", "utf8");
const passwordPanel = readFileSync(
  "app/admin/teams/TeamPasswordPanel.tsx",
  "utf8",
);
const lifecyclePanel = readFileSync(
  "app/admin/teams/TeamLifecyclePanel.tsx",
  "utf8",
);

test("team server-action module exports runtime functions only", () => {
  assert.match(actions, /^"use server";/);
  assert.doesNotMatch(actions, /^export\s+(?:const|let|var|class)\s+/m);
  assert.doesNotMatch(actions, /INITIAL_TEAM_ACTION_RESULT/);

  const runtimeExports = [...actions.matchAll(/^export async function (\w+)/gm)].map(
    ([, name]) => name,
  );
  assert.deepEqual(runtimeExports, [
    "revealTeamPasswordAction",
    "setTeamPasswordAction",
    "randomizeTeamPasswordAction",
    "archiveTeamAction",
    "reactivateTeamAction",
    "deleteTeamAction",
  ]);
});

test("team forms keep initial action state outside the server-action module", () => {
  assert.match(passwordPanel, /teamActionResult/);
  assert.match(lifecyclePanel, /teamActionResult/);
  assert.match(lifecyclePanel, /archiveState\.success[\s\S]+router\.refresh/);
});

test("expected lifecycle conflicts return inline action messages", () => {
  assert.match(actions, /Dieses Team ist bereits archiviert/);
  assert.match(actions, /Dieses Team ist bereits aktiv/);
  assert.match(actions, /Quiz-Historie und kann nur archiviert werden/);
  assert.match(actions, /Teamnamen exakt zur Bestätigung/);
  assert.match(passwordPanel, /aria-live="polite"/);
  assert.match(lifecyclePanel, /aria-live="polite"/);
});
