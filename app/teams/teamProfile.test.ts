import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { getDefaultTeamAvatarCode, mapTeamProfile, TEAM_AVATAR_CODES } from "./teamProfile";

test("default team avatars are stable and cover all ten artwork slots", () => {
  assert.equal(getDefaultTeamAvatarCode(42), getDefaultTeamAvatarCode(42));
  assert.equal(new Set(Array.from({ length: 10 }, (_, index) => getDefaultTeamAvatarCode(index))).size, 10);
  assert.equal(TEAM_AVATAR_CODES.length, 10);
});

test("every stable avatar slot has a deployable raster asset", () => {
  for (const code of TEAM_AVATAR_CODES) {
    assert.equal(existsSync(`public/team-avatars/${code}.webp`), true, code);
  }
});

test("stored profile wins while invalid legacy codes fall back deterministically", () => {
  assert.equal(mapTeamProfile({ team_id: 3, avatar_code: "wecker", foto_url: null, foto_upload_gesperrt: false }).avatarCode, "wecker");
  assert.equal(mapTeamProfile({ team_id: 3, avatar_code: "unknown", foto_url: null, foto_upload_gesperrt: true }).avatarCode, getDefaultTeamAvatarCode(3));
});
