import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260825170000_add_team_profiles/migration.sql", "utf8");
const route = readFileSync("app/api/team-profile-photo/route.ts", "utf8");
const profileServer = readFileSync("app/teams/teamProfile.server.ts", "utf8");
const uploadClient = readFileSync("app/teams/teamPhotoUpload.client.ts", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");

test("photo, avatar and upload lock are global team fields with an additive migration", () => {
  assert.match(schema, /model teams[\s\S]+avatar_code[\s\S]+foto_url[\s\S]+foto_upload_gesperrt/);
  assert.match(migration, /ALTER TABLE "pubquiz"\."teams"/);
  assert.doesNotMatch(migration, /DROP|CASCADE/i);
});

test("team upload authorization is server-side and the participant lock is enforced", () => {
  assert.match(route, /requireParticipantTeamProfile/);
  assert.match(route, /foto_upload_gesperrt/);
  assert.match(route, /isAdministrator/);
  assert.match(profileServer, /assertTeamAccess/);
});

test("participant photo uploads bypass account login but retain signed session authorization", () => {
  assert.match(proxy, /"\/api\/team-profile-photo"/);
  assert.match(route, /handleUploadPresigned/);
  assert.match(route, /requireParticipantTeamProfile/);
  assert.match(route, /MAX_TEAM_PHOTO_UPLOAD_BYTES/);
  assert.doesNotMatch(route, /request\.formData\(\)/);
});

test("the browser checks response content type before decoding upload JSON", () => {
  assert.match(uploadClient, /content-type/);
  assert.match(uploadClient, /response\.text\(\)/);
  assert.doesNotMatch(uploadClient, /response\.json\(\)/);
  assert.match(uploadClient, /Foto konnte nicht hochgeladen werden/);
});

test("profile removal deletes only unreferenced managed team-profile blobs", () => {
  assert.match(profileServer, /teams\.count\(\{ where: \{ foto_url: url \} \}\)/);
  assert.match(profileServer, /getBlobAreaPrefix\([\s\S]+"team-profile"/);
});
