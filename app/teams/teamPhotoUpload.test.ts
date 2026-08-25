import assert from "node:assert/strict";
import test from "node:test";
import { readTeamPhotoUploadResponse, TeamPhotoUploadResponseError } from "./teamPhotoUpload.client";
import {
  buildTeamPhotoUploadPathname,
  isAllowedTeamPhotoUploadPathname,
  MAX_TEAM_PHOTO_UPLOAD_BYTES,
  parseTeamPhotoUploadContext,
  validateTeamPhotoUpload,
} from "./teamPhotoUpload";

test("team photo upload keeps the 8 MB image contract", () => {
  assert.doesNotThrow(() => validateTeamPhotoUpload({ size: MAX_TEAM_PHOTO_UPLOAD_BYTES, type: "image/jpeg" }));
  assert.throws(() => validateTeamPhotoUpload({ size: MAX_TEAM_PHOTO_UPLOAD_BYTES + 1, type: "image/jpeg" }), /8 MB/);
  assert.throws(() => validateTeamPhotoUpload({ size: 1, type: "image/gif" }), /JPG/);
});

test("temporary team photo paths are environment- and team-scoped", () => {
  const pathname = buildTeamPhotoUploadPathname("preview", 42, "camera.jpg");
  assert.match(pathname, /^preview\/team-profile\/pending\/42\/.+\.jpg$/);
  assert.equal(isAllowedTeamPhotoUploadPathname(pathname, "preview", 42), true);
  assert.equal(isAllowedTeamPhotoUploadPathname(pathname, "preview", 43), false);
  assert.equal(isAllowedTeamPhotoUploadPathname(pathname, "prod", 42), false);
});

test("participant upload context requires team, quiz and session token", () => {
  assert.deepEqual(
    parseTeamPhotoUploadContext({ mode: "TEAM", teamId: 7, quizId: 11, sessionToken: "signed-session" }),
    { mode: "TEAM", teamId: 7, quizId: 11, sessionToken: "signed-session" },
  );
  assert.throws(() => parseTeamPhotoUploadContext({ mode: "TEAM", teamId: 7, quizId: 11 }), /Uploadkontext/);
});

test("JSON upload responses return the persisted team profile", async () => {
  const profile = { teamId: 7, avatarCode: "teekanne", photoUrl: "https://example.test/team.webp", photoUploadLocked: false };
  const response = new Response(JSON.stringify({ success: true, profile }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  assert.deepEqual(await readTeamPhotoUploadResponse(response), profile);
});

test("HTML responses become a controlled upload error instead of a JSON parse exception", async () => {
  const response = new Response("<!DOCTYPE html><html><title>Login</title></html>", {
    status: 302,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  await assert.rejects(
    () => readTeamPhotoUploadResponse(response),
    (error) => {
      assert.ok(error instanceof TeamPhotoUploadResponseError);
      assert.equal(error.message, "Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.");
      assert.equal(error.details.responseKind, "HTML");
      assert.equal(error.details.status, 302);
      return true;
    },
  );
});

test("JSON domain errors retain their user-facing message", async () => {
  const response = new Response(JSON.stringify({ success: false, message: "Foto-Uploads sind gesperrt." }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
  await assert.rejects(() => readTeamPhotoUploadResponse(response), /Foto-Uploads sind gesperrt/);
});
