import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { deQuestionEditorMessages } from "@/app/i18n/messages/de/questionEditor";
import { AudioPlayer, MediaPreview } from "@/components/ui";
import { getQuestionMediaSummary, hasQuestionMediaProblem } from "./QuestionMediaSection";

const base = { slots: [], media: [], uploadStatuses: {}, generatorRuns: [] } as const;
const imageSourceInputs = readFileSync(
  "app/fragen/editor/components/ImageSourceInputs.tsx",
  "utf8",
);
const mediaUploadSlot = readFileSync(
  "app/fragen/editor/components/MediaUploadSlot.tsx",
  "utf8",
);
const audioPlayer = readFileSync("components/ui/AudioPlayer.tsx", "utf8");
const questionMediaSlot = readFileSync(
  "app/fragen/editor/components/QuestionMediaSlot.tsx",
  "utf8",
);
const answerMediaSlot = readFileSync(
  "app/fragen/editor/components/AnswerMediaSlot.tsx",
  "utf8",
);

test("media summary covers empty, image, audio and mixed media", () => {
  assert.equal(getQuestionMediaSummary(base, deQuestionEditorMessages), "Keine Medien");
  const image = { slotKey: "question_image", operation: "NEW", url: "https://blob/image", mediaType: "IMAGE", existingMediaId: null, existingMediaCount: 0 } as const;
  const audio = { slotKey: "question_audio", operation: "NEW", url: "https://blob/audio", mediaType: "AUDIO", existingMediaId: null, existingMediaCount: 0 } as const;
  assert.equal(getQuestionMediaSummary({ ...base, media: [image] }, deQuestionEditorMessages), "1 Bild");
  assert.equal(getQuestionMediaSummary({ ...base, media: [audio] }, deQuestionEditorMessages), "1 Audio");
  assert.equal(getQuestionMediaSummary({ ...base, media: [image, audio] }, deQuestionEditorMessages), "1 Bild und 1 Audio");
});

test("media section detects required and stale states", () => {
  assert.equal(hasQuestionMediaProblem({ ...base, slots: [{ key: "music_original_audio", required: true }] as never }), true);
  assert.equal(hasQuestionMediaProblem({ ...base, generatorRuns: [{ status: "STALE" }] as never }), true);
});

test("image slots expose separate gallery and environment-camera inputs", () => {
  assert.match(imageSourceInputs, /label=\{galleryLabel\}/);
  assert.match(imageSourceInputs, /label=\{cameraLabel\}/);
  assert.equal(
    imageSourceInputs.match(/capture="environment"/g)?.length,
    1,
  );
  assert.equal(
    imageSourceInputs.match(/onChange=\{onFileChange\}/g)?.length,
    2,
  );
});

test("both image sources use the shared validation and upload path", () => {
  assert.match(
    mediaUploadSlot,
    /<ImageSourceInputs[\s\S]*onFileChange=\{handleFileInputChange\}/,
  );
  assert.match(
    mediaUploadSlot,
    /const file = input\.files\?\.\[0\];\s+if \(!file\) return;\s+void uploadFile\(file\)/,
  );
  assert.match(mediaUploadSlot, /validateQuestionMediaFile\(file, mediaType\)/);
});

test("question and answer image positions share MediaUploadSlot", () => {
  assert.match(questionMediaSlot, /<MediaUploadSlot/);
  assert.match(answerMediaSlot, /<MediaUploadSlot/);
});

for (const mimeType of ["audio/mpeg", "audio/wav", "audio/ogg"]) {
  test(`audio preview renders a compact player for ${mimeType}`, () => {
    const mediaUrl = `https://blob.example/audio-${mimeType.slice(6)}`;
    const html = renderToStaticMarkup(
      React.createElement(
        MediaPreview,
        {
          layout: "audio",
          title: "original-audio.mp3",
          type: "Audio",
        },
        React.createElement(AudioPlayer, {
          embedded: true,
          src: mediaUrl,
          mimeType,
        }),
      ),
    );

    assert.match(html, /data-media-preview="audio"/);
    assert.match(html, /<audio[^>]*controls=""[^>]*preload="metadata"/);
    assert.match(html, new RegExp(`src="${mediaUrl}"`));
    assert.match(html, new RegExp(`type="${mimeType}"`));
    assert.doesNotMatch(html, /aspect-video/);
    assert.match(html, /original-audio\.mp3/);
  });
}

test("audio preview remains playable without a MIME type", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      MediaPreview,
      { layout: "audio", title: "legacy-audio", type: "Audio" },
      React.createElement(AudioPlayer, {
        embedded: true,
        src: "https://blob.example/legacy-audio",
      }),
    ),
  );

  assert.match(html, /<source src="https:\/\/blob\.example\/legacy-audio"\/>/);
  assert.doesNotMatch(html, /<source[^>]* type=/);
});

test("long audio filenames are constrained and remain available as a title", () => {
  const fileName = `${"technical-prefix-".repeat(12)}audio.ogg`;
  const html = renderToStaticMarkup(
    React.createElement(
      MediaPreview,
      { layout: "audio", title: fileName, type: "Audio" },
      React.createElement(AudioPlayer, {
        embedded: true,
        src: "https://blob.example/audio.ogg",
        mimeType: "audio/ogg",
      }),
    ),
  );

  assert.match(html, /class="[^"]*min-w-0[^"]*"/);
  assert.match(html, /class="truncate text-sm font-medium text-gray-900"/);
  assert.match(html, new RegExp(`title="${fileName}"`));
});

test("visual image and video previews retain the visual aspect-ratio container", () => {
  for (const mediaElement of [
    React.createElement("img", { key: "image", alt: "Bild", src: "/image.jpg" }),
    React.createElement("video", { key: "video", controls: true, src: "/video.mp4" }),
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(
        MediaPreview,
        { title: "medium", type: "Medium" },
        mediaElement,
      ),
    );

    assert.match(html, /data-media-preview="visual"/);
    assert.match(html, /aspect-video/);
  }
});

test("the uploaded-media preview keeps replacement and removal actions", () => {
  assert.match(mediaUploadSlot, /messages\.media\.replace/);
  assert.match(mediaUploadSlot, /messages\.common\.remove/);
  assert.match(mediaUploadSlot, /type="button"[\s\S]*onClick=\{\(\) => onChange\(\{ \.\.\.media!, operation: "REMOVE" \}\)\}/);
});

test("audio load failures stay local to the player and expose an alert", () => {
  assert.match(audioPlayer, /onError=\{\(\) => setHasError\(true\)\}/);
  assert.match(audioPlayer, /hasError && \([\s\S]*role="alert"/);
  assert.match(audioPlayer, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
});
