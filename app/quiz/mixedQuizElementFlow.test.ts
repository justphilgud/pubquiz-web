import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildQuizEditorElements } from "./[quizId]/quizEditorElement";
import type { QuizQuestion } from "./[quizId]/QuizQuestionItem";
import { resolveQuizBlockSequence } from "./flow/quizBlockSequence";
import type { QuizFlowItem } from "./flow/quizFlow";
import {
  aggregateLivePollState,
  type LivePollResponseProjection,
} from "../umfragen/livePollRuntime";
import { resolvePresentationAudienceState } from "../rendering/presentation/presentationLiveState";

const read = (path: string) => readFileSync(path, "utf8");

function question(id: number, order: number): QuizQuestion {
  return {
    quiz_fragen_id: id,
    fragen_id: id + 1_000,
    frage: `Frage ${id}`,
    sortierung: id,
    flowPlacementId: id + 2_000,
    flowOrder: order,
    quiz_abschnitt_id: 1,
    schwierigkeitslevel: null,
    resolvedPresentationLayout: {} as QuizQuestion["resolvedPresentationLayout"],
    punkte_basis: 1,
    punkte_modus: "standard",
    freie_antwort_erlaubt: false,
    ergebnisdarstellung: "STANDARD",
    live_ergebnis_unterstuetzt: false,
    kann_freie_antwort_aktivieren: false,
    effektiver_antwortmodus: "CLOSED",
    vorlagenname: "Standard",
    templateId: null,
    teilpunkte_faehig: false,
    kategorien: [],
    storyElements: [],
  };
}

function flowItem(input: {
  id: number;
  type: QuizFlowItem["type"];
  order: number;
  questionId?: number;
  pollType?: "SINGLE_CHOICE" | "FREE_TEXT";
}): QuizFlowItem {
  return {
    id: `flow:${input.id}`,
    persistentId: input.id,
    type: input.type,
    anchorType: "BLOCK",
    anchorKey: "1",
    sectionId: 1,
    order: input.order,
    enabled: true,
    label: null,
    config: { version: 1 },
    configVersion: 1,
    isStandard: input.type === "QUESTION",
    questionAssignmentId: input.questionId ?? null,
    storyElementId: input.type === "CUSTOM_MESSAGE" ? input.id : null,
    storyElementRevisionId: input.type === "CUSTOM_MESSAGE" ? input.id : null,
    storyQuestionAssignmentId: null,
    storyRelationship: null,
    storyDefaultRelationship: null,
    livePoll: input.pollType ? {
      version: 1,
      pollId: input.id + 100,
      pollRevisionId: input.id + 200,
      type: input.pollType,
      prompt: input.pollType === "SINGLE_CHOICE" ? "Auswahl?" : "Freitext?",
      publicationMode: input.pollType === "FREE_TEXT" ? "MODERATED" : "AUTOMATIC",
      options: input.pollType === "SINGLE_CHOICE"
        ? [{ id: "a", label: "A" }, { id: "b", label: "B" }]
        : [],
    } : null,
  };
}

test("editor uses one ordered card model for question, story and both poll variants", () => {
  const elements = buildQuizEditorElements({
    questions: [question(1, 1_000), question(2, 5_000)],
    stories: [{
      placementId: 20,
      storyElementId: 120,
      title: "Story",
      type: "CUSTOM_MESSAGE",
      quiz_abschnitt_id: 1,
      sortierung: 2_000,
    }],
    polls: [
      { placementId: 30, pollId: 130, title: "Auswahl", type: "SINGLE_CHOICE", publicationMode: "AUTOMATIC", status: "ACTIVE", quiz_abschnitt_id: 1, sortierung: 3_000 },
      { placementId: 40, pollId: 140, title: "Freitext", type: "FREE_TEXT", publicationMode: "MODERATED", status: "ACTIVE", quiz_abschnitt_id: 1, sortierung: 4_000 },
    ],
  });

  assert.deepEqual(elements.map((element) => element.key), [
    "question-1",
    "story-20",
    "poll-30",
    "poll-40",
    "question-2",
  ]);
  assert.equal(elements[0].capabilities.evaluation, true);
  assert.equal(elements[1].capabilities.answerInteraction, false);
  assert.equal(elements[2].capabilities.answerInteraction, true);
  assert.equal(elements[2].capabilities.scoring, false);

  const card = read("app/quiz/[quizId]/QuizEditorElementCard.tsx");
  const editor = read("app/quiz/[quizId]/QuizFragenSortableTable.tsx");
  assert.match(card, /data-quiz-element-kind/);
  assert.match(card, /\{displayIndex\}/);
  assert.match(editor, /editorElements\.map\(\(element, index\)/);
  assert.match(editor, /overflowAction=[\s\S]*Aus Quiz entfernen/);
});

test("canonical block sequence preserves question-story-poll-poll-question order", () => {
  const questions = [
    { quiz_fragen_id: 1, quiz_abschnitt_id: 1, sortierung: 1 },
    { quiz_fragen_id: 2, quiz_abschnitt_id: 1, sortierung: 2 },
  ];
  const items = [
    flowItem({ id: 11, type: "QUESTION", order: 1_000, questionId: 1 }),
    flowItem({ id: 20, type: "CUSTOM_MESSAGE", order: 2_000 }),
    flowItem({ id: 30, type: "LIVE_POLL", order: 3_000, pollType: "SINGLE_CHOICE" }),
    flowItem({ id: 40, type: "LIVE_POLL", order: 4_000, pollType: "FREE_TEXT" }),
    flowItem({ id: 12, type: "QUESTION", order: 5_000, questionId: 2 }),
  ];
  const sequence = resolveQuizBlockSequence({
    sectionId: 1,
    quizStrategy: "AFTER_EACH_QUESTION",
    sectionStrategy: null,
    questions,
    blockItems: items,
  });

  assert.deepEqual(
    sequence.entries
      .filter((entry) => entry.kind !== "QUESTION_SOLUTION")
      .map((entry) => entry.kind === "QUESTION"
        ? `QUESTION:${entry.question.quiz_fragen_id}`
        : entry.item.type === "LIVE_POLL"
          ? `POLL:${entry.item.livePoll?.type}`
          : "STORY"),
    [
      "QUESTION:1",
      "STORY",
      "POLL:SINGLE_CHOICE",
      "POLL:FREE_TEXT",
      "QUESTION:2",
    ],
  );
});

test("poll live projections stay anonymous while moderation keeps private data", () => {
  const responses: LivePollResponseProjection[] = [{
    id: 1,
    teamId: 10,
    teamName: "Team A",
    avatarCode: "toaster",
    photoUrl: null,
    selectedOptionId: null,
    originalText: "Alles Gute",
    publicText: "Alles Gute",
    isVisible: false,
    updatedAt: "2026-08-28T10:00:00.000Z",
  }];
  const hidden = aggregateLivePollState({
    revision: "1",
    runId: 7,
    state: "OPEN",
    config: { version: 1, pollId: 5, pollRevisionId: 6, type: "FREE_TEXT", prompt: "Wünsche?", publicationMode: "MODERATED", options: [] },
    responses,
    includeModeration: true,
  });
  assert.deepEqual(hidden.audience.publicResponses, []);
  assert.equal(hidden.moderationResponses?.[0].teamName, "Team A");
  const published = aggregateLivePollState({
    revision: "2",
    runId: 7,
    state: "OPEN",
    config: { version: 1, pollId: 5, pollRevisionId: 6, type: "FREE_TEXT", prompt: "Wünsche?", publicationMode: "MODERATED", options: [] },
    responses: [{ ...responses[0], isVisible: true }],
    includeModeration: false,
  });
  assert.deepEqual(published.audience.publicResponses.map((entry) => entry.publicText), ["Alles Gute"]);
  assert.equal("teamName" in published.audience.publicResponses[0], false);
});

test("runtime loader and surfaces consume the same content-poll run", () => {
  const actions = read("app/quiz/actions.ts");
  const presentation = read("app/rendering/presentation/PresentationSlideRenderer.tsx");
  const moderation = read("app/quiz/[quizId]/moderation/ModerationClient.tsx");
  const answerForm = read("app/quiz/[quizId]/antworten/QuizAntwortClient.tsx");
  const interaction = read("app/quiz/interaction/interaction.server.ts");

  const presentationLoader = actions.slice(
    actions.indexOf("export async function getQuizPraesentation"),
    actions.indexOf("export async function getQuizAntwortStatus"),
  );
  assert.match(presentationLoader, /live_poll_revision:\s*\{[\s\S]*optionen:\s*true/);
  assert.match(presentation, /type === "LIVE_POLL"/);
  assert.match(presentation, /poll\.publicResponses/);
  assert.match(moderation, /closeContentPoll/);
  assert.match(moderation, /response\.originalText/);
  assert.match(answerForm, /saveLivePoll/);
  assert.match(answerForm, /livePollState\.state !== "OPEN"/);
  assert.match(interaction, /identity\?\.kind === "LIVE_POLL"/);
  assert.doesNotMatch(interaction, /LIVE_POLL[\s\S]{0,200}evaluateBaseAnswer/);

  const storyState = resolvePresentationAudienceState(
    { slideKey: "story-placement:20" },
    [],
  );
  assert.equal(storyState.phase, "NON_QUESTION");
});
