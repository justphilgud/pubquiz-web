import assert from "node:assert/strict";
import test from "node:test";
import { buildBlobPath, isBlobUrlInArea } from "./blobPath";
import { buildQuestionMediaPathname, isAllowedQuestionMediaPathname } from "../fragen/editor/questionMedia";
import { buildTeamPhotoUploadPathname, isAllowedTeamPhotoUploadPathname } from "../teams/teamPhotoUpload";

const a = `preview/${"a".repeat(64)}` as const;
const b = `preview/${"b".repeat(64)}` as const;

test("question upload authorization rejects another branch and legacy shared paths", () => {
  const path = buildQuestionMediaPathname(a, "QUESTION", "IMAGE", "question_image", "same.jpg");
  assert.equal(isAllowedQuestionMediaPathname(path, "IMAGE", "QUESTION", a, "question_image"), true);
  for (const other of [b, "preview", "prod"] as const) {
    assert.equal(isAllowedQuestionMediaPathname(path, "IMAGE", "QUESTION", other, "question_image"), false);
    assert.notEqual(path, buildQuestionMediaPathname(other, "QUESTION", "IMAGE", "question_image", "same.jpg"));
  }
  const legacy = buildQuestionMediaPathname("preview", "QUESTION", "IMAGE", "question_image", "same.jpg");
  assert.equal(isAllowedQuestionMediaPathname(legacy, "IMAGE", "QUESTION", a, "question_image"), false);
});

test("team photo finalization and cleanup stay inside the current branch", () => {
  const path = buildTeamPhotoUploadPathname(a, 42, "same.jpg");
  assert.equal(isAllowedTeamPhotoUploadPathname(path, a, 42), true);
  assert.equal(isAllowedTeamPhotoUploadPathname(path, b, 42), false);
  const url = `https://example.public.blob.vercel-storage.com/${buildBlobPath(a, "team-profile", ["42", "profile.webp"])}`;
  assert.equal(isBlobUrlInArea(url, a, "team-profile"), true);
  assert.equal(isBlobUrlInArea(url, b, "team-profile"), false);
  assert.equal(isBlobUrlInArea(url, "prod", "team-profile"), false);
  assert.equal(isBlobUrlInArea("https://example.test/preview/team-profile/42/old.webp", a, "team-profile"), false);
  assert.equal(isBlobUrlInArea("invalid", a, "team-profile"), false);
});

test("namespace paths cannot contain traversal or arbitrary prefixes", () => {
  assert.throws(() => buildBlobPath("preview/../../prod", "media"));
  assert.throws(() => buildBlobPath(a, "media", [".."]));
  assert.throws(() => buildBlobPath(a, "media", ["%2fother"]));
});
