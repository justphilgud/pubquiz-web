import assert from "node:assert/strict";
import test from "node:test";
import {
  createAnswerMediaDraftFromStoredMedia,
  resolveQuestionMediaUrl,
} from "./questionMedia";

const imageType = { medientyp: "Bild" };

test("persisted answer media keeps its identity and renderable root-relative URL", () => {
  const media = createAnswerMediaDraftFromStoredMedia([
    {
      medien_id: 67,
      datei:
        "/medien/bilder/unsortiert/1780697085263-qrcode-fr-natan-pubquiz---runde-1.png",
      medientyp: imageType,
      slot_key: "answer_image",
    },
  ]);

  assert.deepEqual(media, {
    slotKey: "answer_image",
    existingMediaId: 67,
    url:
      "/medien/bilder/unsortiert/1780697085263-qrcode-fr-natan-pubquiz---runde-1.png",
    mediaType: "IMAGE",
    fileName: "1780697085263-qrcode-fr-natan-pubquiz---runde-1.png",
    operation: "UNCHANGED",
    existingMediaCount: 1,
    blockedReasonCode: undefined,
    blockedReasonParams: undefined,
  });
  assert.equal(resolveQuestionMediaUrl(media.url!), media.url);
});

test("new public Blob URLs remain unchanged", () => {
  const url =
    "https://example.public.blob.vercel-storage.com/dev/answer-media/answer_image/image/new.png";

  assert.equal(resolveQuestionMediaUrl(url), url);
});

test("legacy answer media without a slot key is still assigned to answer_image", () => {
  const media = createAnswerMediaDraftFromStoredMedia([
    {
      medien_id: 12,
      datei: "bilder/legacy-answer.png",
      medientyp: imageType,
    },
  ]);

  assert.equal(media?.slotKey, "answer_image");
  assert.equal(media?.existingMediaId, 12);
  assert.equal(media?.operation, "UNCHANGED");
  assert.equal(
    resolveQuestionMediaUrl(media!.url!),
    "/medien/bilder/legacy-answer.png",
  );
});

test("answer media hydration does not swap media between answers", () => {
  const first = createAnswerMediaDraftFromStoredMedia([
    {
      medien_id: 21,
      datei: "/medien/bilder/first.png",
      medientyp: imageType,
    },
  ]);
  const second = createAnswerMediaDraftFromStoredMedia([
    {
      medien_id: 22,
      datei: "/medien/bilder/second.png",
      medientyp: imageType,
    },
  ]);

  assert.deepEqual(
    [first, second].map((media) => [media?.existingMediaId, media?.url]),
    [
      [21, "/medien/bilder/first.png"],
      [22, "/medien/bilder/second.png"],
    ],
  );
});
