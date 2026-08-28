import assert from "node:assert/strict";
import test from "node:test";
import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import {
  resolvePresentationLayout,
  type ResolvePresentationLayoutInput,
} from "./presentationLayoutResolver";

function resolve(
  input: Partial<ResolvePresentationLayoutInput> & {
    templateId: string | null;
  },
) {
  return resolvePresentationLayout({
    phase: "QUESTION",
    legacyLayout: "standard",
    questionText: "Testfrage",
    answerOptionCount: 1,
    structuredFieldCount: 0,
    media: [],
    ...input,
  });
}

test("every productive question template resolves a valid layout", () => {
  const templateIds = [
    questionTemplateIds.standard,
    questionTemplateIds.multipleChoice,
    questionTemplateIds.faceMorph,
    questionTemplateIds.musicReverse,
    questionTemplateIds.musicEightBit,
    questionTemplateIds.pixelImage,
    questionTemplateIds.trueFalse,
    questionTemplateIds.estimate,
    questionTemplateIds.ordering,
    questionTemplateIds.translationReadAloud,
    questionTemplateIds.anagram,
    questionTemplateIds.googleReviews,
  ];

  for (const templateId of templateIds) {
    assert.ok(resolve({ templateId }).variant);
  }
});

test("standard questions select text, visual and audio layouts from media", () => {
  assert.equal(resolve({ templateId: null }).variant, "CONTENT_CENTERED");
  assert.equal(
    resolve({
      templateId: null,
      media: [
        {
          fileName: "frage.webp",
          mediaType: "Bild",
          scope: "QUESTION",
        },
      ],
    }).variant,
    "MEDIA_FOCUS",
  );
  assert.equal(
    resolve({
      templateId: null,
      media: [
        {
          fileName: "frage.mp3",
          mediaType: "Audio",
          scope: "QUESTION",
        },
      ],
    }).variant,
    "AUDIO_FOCUS",
  );
});

test("template semantics select choice, boolean, ordering, audio and reveal layouts", () => {
  assert.equal(
    resolve({
      templateId: questionTemplateIds.multipleChoice,
      answerOptionCount: 4,
    }).variant,
    "CHOICE_GRID",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.trueFalse }).variant,
    "TRUE_FALSE",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.ordering }).variant,
    "ORDERING",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.musicReverse }).variant,
    "AUDIO_FOCUS",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.musicEightBit }).variant,
    "AUDIO_FOCUS",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.translationReadAloud }).variant,
    "AUDIO_FOCUS",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.pixelImage }).variant,
    "REVEAL_SEQUENCE",
  );
  assert.deepEqual(resolve({ templateId: questionTemplateIds.faceMorph }), {
    variant: "MEDIA_FOCUS",
    source: "AUTO",
    reason: "FACE_MORPH_TEMPLATE",
    contentRole: "FACE_MORPH",
  });
  assert.equal(
    resolve({ templateId: questionTemplateIds.estimate }).variant,
    "CONTENT_CENTERED",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.anagram }).variant,
    "CONTENT_CENTERED",
  );
});

test("the persisted FaceMorph media slot restores the runtime role for legacy assignments", () => {
  assert.deepEqual(
    resolve({
      templateId: null,
      structuredFieldCount: 2,
      media: [
        {
          fileName: "generated-morph.webp",
          mediaType: "Bild",
          scope: "QUESTION",
          slotKey: "face_morph_result",
        },
      ],
    }),
    {
      variant: "MEDIA_FOCUS",
      source: "AUTO",
      reason: "FACE_MORPH_TEMPLATE",
      contentRole: "FACE_MORPH",
    },
  );
});

test("legacy FaceMorph questions restore the visual role from their two named fields and question image", () => {
  assert.deepEqual(
    resolve({
      templateId: null,
      structuredFieldCount: 2,
      structuredFieldLabels: ["Person A", "Person B"],
      media: [
        {
          fileName: "generated-morph.webp",
          mediaType: "Bild",
          scope: "QUESTION",
          slotKey: null,
        },
      ],
    }),
    {
      variant: "MEDIA_FOCUS",
      source: "AUTO",
      reason: "FACE_MORPH_TEMPLATE",
      contentRole: "FACE_MORPH",
    },
  );
});

test("answer media does not turn a normal multiple-choice question into an empty image slide", () => {
  for (const answerOptionCount of [2, 4]) {
    assert.deepEqual(
      resolve({
        templateId: null,
        answerOptionCount,
        media: [
          {
            fileName: "answer-decoration.webp",
            mediaType: "Bild",
            scope: "ANSWER",
          },
        ],
      }),
      {
        variant: "CHOICE_GRID",
        source: "AUTO",
        reason: "CHOICE_OPTIONS",
      },
    );
  }
});

test("question and solution phases resolve independently", () => {
  const question = resolve({
    templateId: questionTemplateIds.multipleChoice,
    answerOptionCount: 4,
  });
  const solution = resolve({
    templateId: questionTemplateIds.multipleChoice,
    answerOptionCount: 4,
    phase: "SOLUTION",
  });

  assert.equal(question.variant, "CHOICE_GRID");
  assert.equal(solution.variant, "SOLUTION_FOCUS");
});

test("compatible legacy overrides survive while invalid values fall back to auto", () => {
  assert.deepEqual(
    resolve({
      templateId: null,
      legacyLayout: "bild_fokus",
    }),
    {
      variant: "MEDIA_FOCUS",
      source: "LEGACY_OVERRIDE",
      reason: "LEGACY_COMPATIBLE",
    },
  );
  assert.deepEqual(
    resolve({
      templateId: questionTemplateIds.trueFalse,
      legacyLayout: "audio_fokus",
    }),
    {
      variant: "TRUE_FALSE",
      source: "AUTO",
      reason: "TRUE_FALSE_TEMPLATE",
    },
  );
  assert.equal(
    resolve({
      templateId: null,
      legacyLayout: "veraltetes_layout",
    }).variant,
    "CONTENT_CENTERED",
  );
});

test("structured and sequential review questions expose their semantics", () => {
  assert.equal(
    resolve({
      templateId: null,
      structuredFieldCount: 2,
    }).variant,
    "STRUCTURED_RESPONSE",
  );
  assert.equal(
    resolve({
      templateId: questionTemplateIds.googleReviews,
      templateData: {
        kind: "GOOGLE_REVIEWS",
        placeId: "",
        placeName: "Test",
        placeAdditionalLabel: "",
        placeAverageRating: null,
        placeReviewCount: null,
        placeMapsUrl: "",
        placeImportedOrEditedAt: "",
        reviews: [],
        explanation: "",
        sequentialReveal: true,
        hideAuthorUntilSolution: false,
        hideRatingUntilSolution: false,
      },
    }).variant,
    "REVEAL_SEQUENCE",
  );
});

test("unknown templates fall back safely and resolution is deterministic", () => {
  const input = {
    templateId: "legacy_unknown",
    questionText: "Unbekannte Altfrage",
    answerOptionCount: 0,
    structuredFieldCount: 0,
    media: [],
  } as const;
  const first = resolve(input);
  const second = resolve(input);

  assert.deepEqual(first, second);
  assert.equal(first.variant, "CONTENT_CENTERED");
});
