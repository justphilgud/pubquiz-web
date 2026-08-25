import assert from "node:assert/strict";
import test from "node:test";
import { getDefaultTeamAvatarCode, mapTeamProfile, TEAM_AVATAR_CODES } from "./teamProfile";

test("default team avatars are stable and cover the ten-object series", () => {
  assert.equal(getDefaultTeamAvatarCode(42), getDefaultTeamAvatarCode(42));
  assert.equal(new Set(Array.from({ length: 10 }, (_, index) => getDefaultTeamAvatarCode(index))).size, 10);
  assert.equal(TEAM_AVATAR_CODES.length, 10);
});

test("stored profile wins while invalid legacy codes fall back deterministically", () => {
  assert.equal(mapTeamProfile({ team_id: 3, avatar_code: "wecker", foto_url: null, foto_upload_gesperrt: false }).avatarCode, "wecker");
  assert.equal(mapTeamProfile({ team_id: 3, avatar_code: "unknown", foto_url: null, foto_upload_gesperrt: true }).avatarCode, getDefaultTeamAvatarCode(3));
});
